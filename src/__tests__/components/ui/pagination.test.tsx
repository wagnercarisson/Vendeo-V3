// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { Pagination } from "@/components/ui/pagination";

describe("Pagination", () => {
  it("returns null when totalPages <= 1", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders previous and next buttons", () => {
    render(
      <Pagination currentPage={2} totalPages={3} onPageChange={() => {}} />,
    );
    expect(screen.getByText("<< Anterior")).toBeInTheDocument();
    expect(screen.getByText("Próximo >>")).toBeInTheDocument();
  });

  it("disables previous button on first page", () => {
    render(
      <Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />,
    );
    expect(screen.getByText("<< Anterior")).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(
      <Pagination currentPage={3} totalPages={3} onPageChange={() => {}} />,
    );
    expect(screen.getByText("Próximo >>")).toBeDisabled();
  });

  it("renders page numbers for 5 or fewer pages", () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />,
    );
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it("renders ellipsis for many pages (>5)", () => {
    render(
      <Pagination currentPage={5} totalPages={10} onPageChange={() => {}} />,
    );
    const ellipses = screen.getAllByText("...");
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("calls onPageChange when clicking a page number", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />,
    );
    fireEvent.click(screen.getByText("2"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange when clicking next button", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />,
    );
    fireEvent.click(screen.getByText("Próximo >>"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange when clicking previous button", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination currentPage={2} totalPages={3} onPageChange={onPageChange} />,
    );
    fireEvent.click(screen.getByText("<< Anterior"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("highlights current page button", () => {
    render(
      <Pagination currentPage={3} totalPages={5} onPageChange={() => {}} />,
    );
    const page3button = screen.getByText("3");
    expect(page3button.className).not.toContain("ghost");
  });
});
