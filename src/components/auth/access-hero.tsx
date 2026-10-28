// Shared navy manifest hero for the secure access surfaces. The visible
// heading lives on the coupon card so the h1 is the page's job; this hero
// carries the system identity, the route and the validation stamp.
export function AccessHero({
  lead,
  tail,
  description,
  stamp = 'Owner + trainee',
}: {
  lead: string
  tail: string
  description: string
  stamp?: string
}) {
  return (
    <section className="mf-logon-hero" aria-label="Secure system access">
      <div className="mf-logon-brand">
        <span className="mf-mark" aria-hidden>
          AV
        </span>
        <div>
          <b>ABAP-Studio</b>
          <span>System MER · Client 105</span>
        </div>
      </div>

      <div className="mf-logon-statement">
        <p className="mf-logon-big">
          {lead}
          <br />
          <em>{tail}</em>
        </p>
        <p className="mf-logon-desc">{description}</p>

        <div className="mf-logon-route" aria-hidden>
          <svg viewBox="0 0 560 62" preserveAspectRatio="none">
            <path
              d="M2 50 C130 2 430 2 558 50"
              fill="none"
              stroke="rgba(185, 211, 238, .55)"
              strokeWidth="1.5"
            />
            <circle cx="2" cy="50" r="4" fill="#6cb6f5" />
            <circle cx="280" cy="13" r="4" fill="#f4f7fa" />
            <circle cx="558" cy="50" r="4" fill="#fcf7be" />
          </svg>
          <div className="mf-logon-route-labels">
            <span>Identity</span>
            <span>Clerk</span>
            <span>Workbench</span>
          </div>
        </div>
      </div>

      <div className="mf-logon-foot">
        <div>
          Secure identity by Clerk
          <br />
          Email OTP + Google
        </div>
        <span className="mf-stamp">{stamp}</span>
      </div>
    </section>
  )
}
