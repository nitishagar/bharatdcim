import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock browser APIs before importing
const mockClick = vi.fn();
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

// Mock URL static methods
Object.defineProperty(URL, 'createObjectURL', { value: mockCreateObjectURL, writable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: mockRevokeObjectURL, writable: true });

import { exportToCSV } from './csvExport';

describe('exportToCSV', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let appendChildSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let removeChildSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let createElementSpy: any;
  let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClick.mockClear();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();

    mockAnchor = { href: '', download: '', click: mockClick };
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLElement;
      return document.createElement.call(document, tag);
    });
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers a download (click is called)', () => {
    exportToCSV('test', ['Name', 'Value'], [['Alice', '100']]);
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('appends .csv extension when missing', () => {
    exportToCSV('meters', ['Name'], [['Alice']]);
    expect(mockAnchor.download).toBe('meters.csv');
  });

  it('keeps .csv extension when already present', () => {
    exportToCSV('meters.csv', ['Name'], [['Alice']]);
    expect(mockAnchor.download).toBe('meters.csv');
  });

  it('handles empty rows without error', () => {
    exportToCSV('empty', ['Name', 'Value'], []);
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('creates a Blob with CSV content type', () => {
    exportToCSV('test', ['Name'], [['Alice']]);
    const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/csv;charset=utf-8;');
  });

  it('revokes the object URL after clicking', () => {
    exportToCSV('test', ['Name'], [['Alice']]);
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('appends and removes the anchor from document body', () => {
    exportToCSV('test', ['Name'], [['Alice']]);
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });
});
