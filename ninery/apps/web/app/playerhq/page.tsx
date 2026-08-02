"use client";

import { usePlayerProfile } from "../player-profile-context";
import styles from "./playerhq.module.css";

export default function PlayerHQPage() {
  const { profile } = usePlayerProfile();
  const playerName = profile.firstName || "Jackson";

  const cards = [
    {
      title: "Basic Information",
      items: [
        ["First Name", profile.firstName],
        ["Last Name", profile.lastName],
        ["Birth Date", profile.birthDate]
      ]
    },
    {
      title: "Physical Profile",
      items: [
        ["Height", profile.height],
        ["Weight", profile.weight],
        ["Dominant Hand", profile.dominantHand],
        ["Bats", profile.bats],
        ["Throws", profile.throws]
      ]
    },
    {
      title: "Baseball Profile",
      items: [
        ["Primary Position", profile.primaryPosition],
        ["Secondary Position", profile.secondaryPosition],
        ["Competition Level", profile.competitionLevel],
        ["Years Playing", profile.yearsPlaying],
        ["Graduation Year", profile.graduationYear]
      ]
    },
    {
      title: "Current Equipment",
      items: [
        ["Current Bat Brand", profile.currentBatBrand],
        ["Current Bat Model", profile.currentBatModel],
        ["Length", profile.currentBatLength],
        ["Weight", profile.currentBatWeight],
        ["Likes Current Bat?", profile.likesCurrentBat]
      ]
    },
    {
      title: "Goals",
      items: [["Selected Goals", profile.goals.join(", ")]]
    }
  ];

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <a className={styles.logo} href="/" aria-label="Ninery home">
            <span>N</span>
            Ninery
          </a>
        </header>

        <section className={styles.hero}>
          <p className={styles.kicker}>PlayerHQ™</p>
          <h1>Welcome, {playerName}!</h1>
          <p>Your player profile is ready.</p>
          <button type="button" disabled>
            Start BatMatch™
          </button>
        </section>

        <section className={styles.cards} aria-label="Player profile details">
          {cards.map((card) => (
            <article className={styles.card} key={card.title}>
              <h2>{card.title}</h2>
              <dl>
                {card.items.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "Not provided"}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
