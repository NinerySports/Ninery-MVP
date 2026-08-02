"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  initialPlayerSetupProfile,
  type PlayerSetupProfile,
  usePlayerProfile
} from "../../player-profile-context";
import styles from "./player-setup.module.css";

const steps = [
  "Basic Information",
  "Physical Profile",
  "Baseball Profile",
  "Current Equipment",
  "Goals",
  "Review"
];

const positions = ["Pitcher", "Catcher", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "Utility"];
const competitionLevels = ["Recreational", "Little League", "School", "Travel", "Elite Travel", "Showcase"];
const goalOptions = [
  "Improve Contact",
  "More Power",
  "Better Bat Control",
  "Confidence",
  "Preparing for BBCOR",
  "Other"
];

type TextFieldProps = {
  label: string;
  name: keyof PlayerSetupProfile;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (name: keyof PlayerSetupProfile, value: string) => void;
};

function TextField({ label, name, value, type = "text", placeholder, onChange }: TextFieldProps) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  name: keyof PlayerSetupProfile;
  value: string;
  options: string[];
  onChange: (name: keyof PlayerSetupProfile, value: string) => void;
};

function SelectField({ label, name, value, options, onChange }: SelectFieldProps) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select name={name} value={value} onChange={(event) => onChange(name, event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function PlayerSetupPage() {
  const router = useRouter();
  const { saveProfile } = usePlayerProfile();
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState<PlayerSetupProfile>(initialPlayerSetupProfile);

  const progress = useMemo(() => ((currentStep + 1) / steps.length) * 100, [currentStep]);

  function updateField(name: keyof PlayerSetupProfile, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function toggleGoal(goal: string) {
    setForm((current) => {
      const exists = current.goals.includes(goal);

      return {
        ...current,
        goals: exists ? current.goals.filter((item) => item !== goal) : [...current.goals, goal]
      };
    });
  }

  function finishSetup() {
    saveProfile(form);
    router.push("/playerhq");
  }

  const reviewRows = [
    ["Player First Name", form.firstName],
    ["Player Last Name", form.lastName],
    ["Birth Date", form.birthDate],
    ["Height", form.height],
    ["Weight", form.weight],
    ["Dominant Hand", form.dominantHand],
    ["Bats", form.bats],
    ["Throws", form.throws],
    ["Primary Position", form.primaryPosition],
    ["Secondary Position", form.secondaryPosition],
    ["Competition Level", form.competitionLevel],
    ["Years Playing", form.yearsPlaying],
    ["Graduation Year", form.graduationYear],
    ["Current Bat Brand", form.currentBatBrand],
    ["Current Bat Model", form.currentBatModel],
    ["Length", form.currentBatLength],
    ["Weight", form.currentBatWeight],
    ["Likes Current Bat?", form.likesCurrentBat],
    ["Goals", form.goals.join(", ")]
  ];

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <a className={styles.logo} href="/" aria-label="Ninery home">
            <span>N</span>
            Ninery
          </a>
          <p>Player Setup</p>
        </header>

        <div className={styles.hero}>
          <p className={styles.kicker}>PlayerHQ Setup</p>
          <h1>Build the player profile behind smarter bat recommendations.</h1>
        </div>

        <div className={styles.progress} aria-label="Setup progress">
          <div className={styles.progressHeader}>
            <span>
              Step {currentStep + 1} of {steps.length}
            </span>
            <strong>{steps[currentStep]}</strong>
          </div>
          <div className={styles.track}>
            <div style={{ width: `${progress}%` }} />
          </div>
          <ol className={styles.stepList}>
            {steps.map((step, index) => (
              <li className={index <= currentStep ? styles.activeStep : ""} key={step}>
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <section className={styles.card}>
          {currentStep === 0 && (
            <div className={styles.formGrid}>
              <TextField label="Player First Name" name="firstName" value={form.firstName} onChange={updateField} />
              <TextField label="Player Last Name" name="lastName" value={form.lastName} onChange={updateField} />
              <TextField label="Birth Date" name="birthDate" value={form.birthDate} type="date" onChange={updateField} />
            </div>
          )}

          {currentStep === 1 && (
            <div className={styles.formGrid}>
              <TextField label="Height" name="height" value={form.height} placeholder="5 ft 2 in" onChange={updateField} />
              <TextField label="Weight" name="weight" value={form.weight} placeholder="105 lb" onChange={updateField} />
              <SelectField
                label="Dominant Hand"
                name="dominantHand"
                value={form.dominantHand}
                options={["Left", "Right"]}
                onChange={updateField}
              />
              <SelectField label="Bats" name="bats" value={form.bats} options={["Left", "Right", "Switch"]} onChange={updateField} />
              <SelectField label="Throws" name="throws" value={form.throws} options={["Left", "Right"]} onChange={updateField} />
            </div>
          )}

          {currentStep === 2 && (
            <div className={styles.formGrid}>
              <SelectField label="Primary Position" name="primaryPosition" value={form.primaryPosition} options={positions} onChange={updateField} />
              <SelectField
                label="Secondary Position"
                name="secondaryPosition"
                value={form.secondaryPosition}
                options={positions}
                onChange={updateField}
              />
              <SelectField
                label="Competition Level"
                name="competitionLevel"
                value={form.competitionLevel}
                options={competitionLevels}
                onChange={updateField}
              />
              <TextField label="Years Playing" name="yearsPlaying" value={form.yearsPlaying} type="number" onChange={updateField} />
              <TextField
                label="Graduation Year (optional)"
                name="graduationYear"
                value={form.graduationYear}
                type="number"
                onChange={updateField}
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className={styles.formGrid}>
              <TextField label="Current Bat Brand" name="currentBatBrand" value={form.currentBatBrand} onChange={updateField} />
              <TextField label="Current Bat Model" name="currentBatModel" value={form.currentBatModel} onChange={updateField} />
              <TextField label="Length" name="currentBatLength" value={form.currentBatLength} placeholder="29 in" onChange={updateField} />
              <TextField label="Weight" name="currentBatWeight" value={form.currentBatWeight} placeholder="19 oz" onChange={updateField} />
              <SelectField
                label="Likes Current Bat?"
                name="likesCurrentBat"
                value={form.likesCurrentBat}
                options={["Yes", "No"]}
                onChange={updateField}
              />
            </div>
          )}

          {currentStep === 4 && (
            <div className={styles.goalGrid}>
              {goalOptions.map((goal) => (
                <label className={styles.goalOption} key={goal}>
                  <input type="checkbox" checked={form.goals.includes(goal)} onChange={() => toggleGoal(goal)} />
                  <span>{goal}</span>
                </label>
              ))}
            </div>
          )}

          {currentStep === 5 && (
            <div className={styles.reviewGrid}>
              {reviewRows.map(([label, value]) => (
                <div className={styles.reviewItem} key={label}>
                  <span>{label}</span>
                  <strong>{value || "Not provided"}</strong>
                </div>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <button type="button" disabled={currentStep === 0} onClick={() => setCurrentStep((step) => step - 1)}>
              {currentStep === 5 ? "Back" : "Previous"}
            </button>
            {currentStep < steps.length - 1 ? (
              <button type="button" className={styles.primaryButton} onClick={() => setCurrentStep((step) => step + 1)}>
                Continue
              </button>
            ) : (
              <button type="button" className={styles.primaryButton} onClick={finishSetup}>
                Finish
              </button>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
