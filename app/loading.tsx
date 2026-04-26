export default function Loading() {
  // Global app-router loading UI for slow navigations / streaming.
  // Keeps the background consistent so we never flash white/blank.
  return (
    <div className="page-loading" aria-label="Loading">
      <div className="page-loading__card">
        <div className="page-loading__logo" aria-hidden="true" />
        <div className="page-loading__lines" aria-hidden="true">
          <div className="page-loading__line" />
          <div className="page-loading__line page-loading__line--short" />
        </div>
      </div>
    </div>
  );
}

