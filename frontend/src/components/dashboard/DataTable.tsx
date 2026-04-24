import React, { useRef, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search, Download, ArrowUpDown, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CsvRow, getCsvValue, parseCsv } from '@/lib/csv';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchable?: boolean;
  exportable?: boolean;
  onExport?: () => void;
  importable?: boolean;
  onImport?: (rows: CsvRow[]) => Promise<void> | void;
  actions?: (item: T) => React.ReactNode;
}

function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  pageSize = 10,
  searchable = true,
  exportable = true,
  onExport,
  importable = true,
  onImport,
  actions,
}: DataTableProps<T>) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [localImportedRows, setLocalImportedRows] = useState<T[]>([]);

  const tableData = localImportedRows.length ? [...localImportedRows, ...data] : data;

  const filtered = tableData.filter((item) =>
    Object.values(item).some((val) =>
      String(val).toLowerCase().includes(search.toLowerCase())
    )
  );

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const aVal = a[sortKey]; const bVal = b[sortKey];
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filtered;

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleExport = () => {
    if (onExport) return onExport();
    const headers = columns.map(c => c.label).join(',');
    const rows = filtered.map(item => columns.map(c => String(item[c.key] ?? '')).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const convertCsvRowsToTableRows = (rows: CsvRow[]): T[] => {
    return rows.map((row) => {
      const converted = columns.reduce<Record<string, unknown>>((acc, column) => {
        acc[column.key] = getCsvValue(row, [column.key, column.label]);
        return acc;
      }, {});
      return converted as T;
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const rows = parseCsv(content);
      if (!rows.length) {
        toast({ title: 'Import failed', description: 'CSV has no data rows.', variant: 'destructive' });
        return;
      }

      if (onImport) {
        await onImport(rows);
      } else {
        const convertedRows = convertCsvRowsToTableRows(rows);
        setLocalImportedRows(convertedRows);
        toast({ title: 'Import complete', description: `${convertedRows.length} row(s) loaded.` });
      }
    } catch (error) {
      toast({ title: 'Import failed', description: (error as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        {searchable && (
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-9"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          {importable && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1.5" />Import CSV
              </Button>
            </>
          )}
          {exportable && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1.5" />Export CSV
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={col.sortable !== false ? 'cursor-pointer select-none' : ''}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </TableHead>
              ))}
              {actions && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                  No data found
                </TableCell>
              </TableRow>
            ) : paged.map((item, i) => (
              <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {col.render ? col.render(item) : String(item[col.key] ?? '')}
                  </TableCell>
                ))}
                {actions && <TableCell>{actions(item)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
