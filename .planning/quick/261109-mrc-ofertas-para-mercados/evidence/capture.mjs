import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const url = process.argv[2];
const prefix = process.argv[3] ?? "capture";
const outDir = path.resolve(
  ".planning/quick/261109-mrc-ofertas-para-mercados/evidence",
);
mkdirSync(outDir, { recursive: true });

const profile = path.join(process.env.TEMP ?? "C:/Windows/Temp", `vendeo-cdp-${Date.now()}`);
mkdirSync(profile, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--remote-debugging-port=9222",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDebugger() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch("http://127.0.0.1:9222/json/list");
      if (res.ok) return await res.json();
    } catch {}
    await sleep(100);
  }
  throw new Error("Chrome DevTools endpoint did not become ready");
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    if (message.method) {
      const handlers = listeners.get(message.method) ?? [];
      for (const handler of handlers) handler(message.params);
    }
  });
  return {
    send(method, params = {}) {
      const messageId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(messageId, { resolve, reject });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
    once(method, timeoutMs = 30000) {
      return new Promise((resolve, reject) => {
        const handler = (params) => {
          clearTimeout(timer);
          const arr = listeners.get(method) ?? [];
          listeners.set(
            method,
            arr.filter((h) => h !== handler),
          );
          resolve(params);
        };
        const timer = setTimeout(
          () => reject(new Error(`Timed out waiting for ${method}`)),
          timeoutMs,
        );
        listeners.set(method, [...(listeners.get(method) ?? []), handler]);
      });
    },
    close() {
      ws.close();
    },
  };
}

const LCP_SCRIPT = `
  window.__lcpEntries = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__lcpEntries.push({
          element: entry.element ? entry.element.tagName : null,
          id: entry.element ? entry.element.id : null,
          url: entry.url || null,
          time: entry.startTime,
          size: entry.size,
        });
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (error) {
    window.__lcpEntries.push({ error: String(error) });
  }
`;

const MEASURE_SCRIPT = `
(() => {
  const images = Array.from(document.images).map((img) => {
    const rect = img.getBoundingClientRect();
    return {
      src: img.getAttribute("src"),
      currentSrc: img.currentSrc,
      alt: img.alt,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      renderedWidth: Math.round(rect.width * 100) / 100,
      renderedHeight: Math.round(rect.height * 100) / 100,
      complete: img.complete,
      loading: img.loading,
      fetchPriority: img.fetchPriority,
    };
  });
  const offer = document.querySelector("[data-offer-card]");
  const groups = Array.from(document.querySelectorAll("[data-access-cta-group]")).map((el) => ({
    mode: el.getAttribute("data-access-mode"),
    state: el.getAttribute("data-signup-state"),
  }));
  return {
    url: location.href,
    title: document.title,
    h1: document.querySelector("h1")?.textContent?.trim() ?? null,
    h2: Array.from(document.querySelectorAll("h2")).map((el) => el.textContent?.trim()),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    themeColor: getComputedStyle(document.body).backgroundColor,
    offer: offer
      ? {
          variant: offer.getAttribute("data-offer-card"),
          state: offer.getAttribute("data-offer-state"),
          id: offer.id,
        }
      : null,
    accessGroups: groups,
    noticeCount: (document.body.innerText.match(/As lojas e campanhas apresentadas são exemplos demonstrativos/g) ?? []).length,
    copyPresent: {
      h1: document.body.innerText.includes("Sua oferta merece chamar atenção. Sem complicar sua rotina."),
      explanation: document.body.innerText.includes("Você informa o produto, o preço anterior, o preço promocional e o período de validade da oferta."),
      kit: document.body.innerText.includes("Coxão Mole Bovino por R$ 39,90/kg"),
      coffee: document.body.innerText.includes("Outra categoria, a mesma identidade."),
    },
    images,
    lcp: window.__lcpEntries ?? [],
  };
})()
`;

try {
  const targets = await waitForDebugger();
  const pageTarget = targets.find((target) => target.type === "page") ?? targets[0];
  const cdp = await connect(pageTarget.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: LCP_SCRIPT });

  const viewports = [
    { name: "desktop-1440", width: 1440, height: 900, dpr: 1, mobile: false },
    { name: "tablet-834", width: 834, height: 1112, dpr: 1, mobile: false },
    { name: "mobile-390", width: 390, height: 844, dpr: 1, mobile: true },
    { name: "mobile-390-dpr3", width: 390, height: 844, dpr: 3, mobile: true },
  ];

  const results = {};
  for (const viewport of viewports) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.dpr,
      mobile: viewport.mobile,
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", {
      enabled: viewport.mobile,
      maxTouchPoints: viewport.mobile ? 5 : 1,
    });
    const loaded = cdp.once("Page.loadEventFired", 45000);
    await cdp.send("Page.navigate", { url });
    await loaded;
    await sleep(900);

    // Trigger the lazy coffee image and any below-the-fold loading.
    await cdp.send("Runtime.evaluate", {
      expression: "window.scrollTo(0, document.documentElement.scrollHeight)",
    });
    await sleep(700);
    await cdp.send("Runtime.evaluate", { expression: "window.scrollTo(0, 0)" });
    await sleep(500);

    // Wait for every image to be decoded before measuring or screenshotting.
    await cdp.send("Runtime.evaluate", {
      expression:
        "Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => undefined)))",
      awaitPromise: true,
    });
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const style = document.createElement("style");
          style.textContent = "nextjs-portal { display: none !important; }";
          document.head.appendChild(style);
        })()
      `,
    });
    await sleep(400);

    const measurement = await cdp.send("Runtime.evaluate", {
      expression: MEASURE_SCRIPT,
      returnByValue: true,
    });
    results[viewport.name] = measurement.result.value;

    if (viewport.name !== "mobile-390-dpr3") {
      const viewportShot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
      });
      writeFileSync(
        path.join(outDir, `${prefix}-${viewport.name}-viewport.png`),
        Buffer.from(viewportShot.data, "base64"),
      );

      const metrics = await cdp.send("Page.getLayoutMetrics");
      const content = metrics.cssContentSize;
      await sleep(500);
      const shot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: {
          x: 0,
          y: 0,
          width: content.width,
          height: content.height,
          scale: 1,
        },
      });
      writeFileSync(
        path.join(outDir, `${prefix}-${viewport.name}.png`),
        Buffer.from(shot.data, "base64"),
      );

      if (viewport.name === "mobile-390") {
        await cdp.send("Runtime.evaluate", {
          expression:
            "document.querySelector('#demonstracao-heading')?.scrollIntoView({ block: 'start' })",
        });
        await sleep(600);
        const pairShot = await cdp.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
        });
        writeFileSync(
          path.join(outDir, `${prefix}-${viewport.name}-pair.png`),
          Buffer.from(pairShot.data, "base64"),
        );
      }
    }
  }

  writeFileSync(
    path.join(outDir, `${prefix}-measurements.json`),
    `${JSON.stringify(results, null, 2)}\n`,
  );
  console.log(`Captured ${prefix}: ${Object.keys(results).join(", ")}`);
  cdp.close();
} finally {
  chrome.kill();
  await sleep(300);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
