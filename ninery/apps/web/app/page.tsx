import styles from "./page.module.css";

const trustCards = [
  {
    title: "Personalized Recommendations",
    copy: "Bat guidance shaped by the player's size, age, goals, swing feel, and current equipment."
  },
  {
    title: "Explainable Results",
    copy: "Clear reasoning behind every recommendation, so families understand the tradeoffs before they buy."
  },
  {
    title: "Built for Baseball Families",
    copy: "A calmer way to compare bats, avoid guesswork, and make confident decisions season after season."
  }
];

const steps = [
  {
    eyebrow: "01",
    title: "Build PlayerHQ",
    copy: "Create a living player profile with growth, position, competition level, and development context."
  },
  {
    eyebrow: "02",
    title: "Complete BatMatch",
    copy: "Answer a guided interview that translates player needs into practical equipment signals."
  },
  {
    eyebrow: "03",
    title: "Review Your Decision Book",
    copy: "See the recommendation, why it fits, what to watch for, and the best next steps."
  }
];

export default function Page() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.logo} href="/" aria-label="Ninery home">
          <span className={styles.logoMark}>N</span>
          <span>Ninery</span>
        </a>
        <nav className={styles.nav} aria-label="Main navigation">
          <a href="#how-it-works">How It Works</a>
          <a href="#trust">Why Ninery</a>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroContent}>
          <p className={styles.kicker}>Baseball Equipment Intelligence</p>
          <h1 id="hero-title">The smartest way to choose a baseball bat.</h1>
          <p className={styles.subheadline}>
            Ninery combines Player Intelligence, Equipment Intelligence, and clear recommendation logic
            so families can choose with confidence instead of guessing from a crowded bat wall.
          </p>
          <div className={styles.actions} aria-label="Homepage actions">
            <a className={styles.primaryCta} href="/setup/player">
              Create Account
            </a>
            <a className={styles.secondaryCta} href="#how-it-works">
              See How It Works
            </a>
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="Ninery recommendation preview">
          <div className={styles.visualTopline}>
            <span>PlayerHQ</span>
            <strong>Bat fit score</strong>
          </div>
          <div className={styles.scoreRing}>
            <span>94</span>
            <small>Confidence</small>
          </div>
          <div className={styles.fitRows}>
            <div>
              <span>Bat Control</span>
              <strong>High</strong>
            </div>
            <div>
              <span>Swing Balance</span>
              <strong>Balanced</strong>
            </div>
            <div>
              <span>Transition Fit</span>
              <strong>Ready</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.trust} id="trust" aria-label="Ninery trust cards">
        {trustCards.map((card) => (
          <article className={styles.trustCard} key={card.title}>
            <h2>{card.title}</h2>
            <p>{card.copy}</p>
          </article>
        ))}
      </section>

      <section className={styles.howItWorks} id="how-it-works" aria-labelledby="how-it-works-title">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>How It Works</p>
          <h2 id="how-it-works-title">From player context to a confident decision.</h2>
        </div>
        <div className={styles.steps}>
          {steps.map((step) => (
            <article className={styles.step} key={step.title}>
              <span>{step.eyebrow}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
