export default function NotFound() {
  return (
    <section className="section shell" aria-labelledby="notfound-title">
      <div className="section-head">
        <p className="eyebrow">404</p>
      </div>
      <h1 className="approach__heading" id="notfound-title">
        That page doesn&apos;t exist.
      </h1>
      <p className="copy contact__body">
        The address you followed isn&apos;t on this site.{" "}
        <a className="link" href="/">
          Back to the start
        </a>
        .
      </p>
    </section>
  );
}
