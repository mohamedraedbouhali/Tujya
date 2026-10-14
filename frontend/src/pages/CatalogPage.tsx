import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type CellLine, type Drug, type Page } from "../api";
import { Alert, Badge, Pagination, staggerIndex, TableSkeleton } from "../components";
import { useDebounced, useQuery } from "../hooks";
import { useI18n, type MessageKey } from "../i18n";
import { Icon, type IconName } from "../icons";

const PAGE_SIZE = 25;

interface Column<T> {
  header: MessageKey;
  /** `n` writes a number the way the current language does. */
  cell: (row: T, n: (value: number) => string) => ReactNode;
  numeric?: boolean;
}

interface CatalogProps<T> {
  title: MessageKey;
  subtitle: MessageKey;
  icon: IconName;
  searchLabel: MessageKey;
  load: (query: { q: string; page: number; page_size: number }, signal: AbortSignal) => Promise<Page<T>>;
  rowKey: (row: T) => string;
  columns: Column<T>[];
}

/** A searchable, paginated table over one of the processed tables. */
function Catalog<T>({ title, subtitle, icon, searchLabel, load, rowKey, columns }: CatalogProps<T>) {
  const { t, n, err } = useI18n();
  // The search lives in the address (?q=...), so a search can be linked to and survives reload.
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const result = useQuery((signal) => load({ q, page, page_size: PAGE_SIZE }, signal), [q, page]);

  useEffect(() => {
    if ((params.get("q") ?? "") !== q) setParams(q ? { q } : {}, { replace: true });
  }, [q, params, setParams]);

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <span className="page-icon">
            <Icon name={icon} size={24} />
          </span>
          <div>
            <h1>{t(title)}</h1>
            <p className="muted">{t(subtitle)}</p>
          </div>
        </div>
        {result.data && (
          <span className="result-count" aria-live="polite">
            <strong>{n(result.data.total)}</strong> {t(q ? "catalog.matching" : "catalog.inTotal")}
          </span>
        )}
      </header>

      <div className="toolbar">
        <label className="search-box">
          <Icon name="search" />
          <input
            type="search"
            aria-label={t(searchLabel)}
            placeholder={t(searchLabel)}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {result.error != null && <Alert>{err(result.error)}</Alert>}
      {!result.data && result.loading && <TableSkeleton rows={10} />}

      {result.data && (
        <div className="card table-card" aria-busy={result.loading}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.header} className={column.numeric ? "num" : undefined}>
                      {t(column.header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Rows are keyed by record, so the ones a new page brings in play their entrance. */}
                {result.data.items.map((row, index) => (
                  <tr key={rowKey(row)} className="row-enter" style={staggerIndex(index)}>
                    {columns.map((column) => (
                      <td key={column.header} className={column.numeric ? "num" : undefined}>
                        {column.cell(row, n)}
                      </td>
                    ))}
                  </tr>
                ))}
                {result.data.items.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="empty">
                      {q ? t("catalog.nothing", { q }) : t("catalog.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={result.data.total}
            onPage={setPage}
          />
        </div>
      )}
    </>
  );
}

const dash = <span className="muted">—</span>;

function Sources({ names }: { names: string[] }) {
  return (
    <span className="badge-row">
      {names.map((name) => (
        <Badge tone="neutral" key={name}>
          {name}
        </Badge>
      ))}
    </span>
  );
}

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

// The contents of these tables are scientific names and identifiers, the same in every
// language. Only the column titles are translated.
const DRUG_COLUMNS: Column<Drug>[] = [
  {
    header: "col.drug",
    cell: (drug) => (
      <>
        <span className="cell-title">{drug.name}</span>
        {drug.synonyms.length > 0 && (
          <span className="cell-sub">{drug.synonyms.slice(0, 3).join(" · ")}</span>
        )}
      </>
    ),
  },
  {
    header: "col.pubchem",
    cell: (drug) =>
      drug.pubchem_cid == null ? (
        dash
      ) : (
        <External href={`https://pubchem.ncbi.nlm.nih.gov/compound/${drug.pubchem_cid}`}>
          {drug.pubchem_cid}
        </External>
      ),
  },
  {
    header: "col.chembl",
    cell: (drug) =>
      drug.chembl_id ? (
        <External
          href={`https://www.ebi.ac.uk/chembl/explore/compound/${encodeURIComponent(drug.chembl_id)}`}
        >
          {drug.chembl_id}
        </External>
      ) : (
        dash
      ),
  },
  { header: "col.sources", cell: (drug) => <Sources names={drug.sources} /> },
  { header: "col.measurements", numeric: true, cell: (drug, n) => n(drug.n_measurements) },
];

const CELL_LINE_COLUMNS: Column<CellLine>[] = [
  { header: "col.cellLine", cell: (line) => <span className="cell-title">{line.name}</span> },
  { header: "col.tissue", cell: (line) => line.tissue ?? dash },
  { header: "col.disease", cell: (line) => line.disease ?? dash },
  {
    header: "col.depmap",
    cell: (line) =>
      line.depmap_id ? (
        <External href={`https://depmap.org/portal/cell_line/${encodeURIComponent(line.depmap_id)}`}>
          {line.depmap_id}
        </External>
      ) : (
        dash
      ),
  },
  { header: "col.sources", cell: (line) => <Sources names={line.sources} /> },
  { header: "col.measurements", numeric: true, cell: (line, n) => n(line.n_measurements) },
];

export function DrugsPage() {
  return (
    <Catalog
      title="drugs.title"
      subtitle="drugs.subtitle"
      icon="pill"
      searchLabel="drugs.search"
      load={api.drugs}
      rowKey={(drug) => drug.drug_id}
      columns={DRUG_COLUMNS}
    />
  );
}

export function CellLinesPage() {
  return (
    <Catalog
      title="lines.title"
      subtitle="lines.subtitle"
      icon="cells"
      searchLabel="lines.search"
      load={api.cellLines}
      rowKey={(line) => line.cell_line_id}
      columns={CELL_LINE_COLUMNS}
    />
  );
}
