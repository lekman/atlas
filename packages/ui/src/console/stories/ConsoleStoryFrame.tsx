/**
 * The console at a fixed screen size, with invented data, for stories. It
 * holds the state a real page would: the section, the selected item, the
 * fleet and whether settings is open. Lists other than Missions are empty
 * until their step is built.
 */
import { sampleDataset } from "@atlas/fixtures";
import { useState } from "react";

import { ConsoleFrame } from "../ConsoleFrame";
import type { RelayState } from "../layout";
import { SectionHeading } from "../SectionHeading";
import { sectionNames, sectionPurposes, type Section } from "../sections";
import type { Fleet } from "../TopBar";

/** Two invented fleets: the reader's work account and a personal one. */
export const storyFleets: Fleet[] = [
  {
    id: "work",
    label: "Work",
    shortLabel: "WRK",
    mark: "diamond",
    tone: "amber",
  },
  {
    id: "personal",
    label: "Personal",
    shortLabel: "PER",
    mark: "circle",
    tone: "blue",
  },
];

const items = sampleDataset.items.slice(0, 8);

export interface ConsoleStoryFrameProps {
  /** The screen size in CSS pixels. */
  width: number;
  height: number;
  /** The section the story opens on. */
  section?: Section;
  /** An item selected when the story opens. */
  selectedId?: string;
  relay?: RelayState;
}

export function ConsoleStoryFrame({
  width,
  height,
  section: initialSection = "missions",
  selectedId: initialSelected,
  relay = { kind: "live" },
}: ConsoleStoryFrameProps) {
  const [section, setSection] = useState<Section>(initialSection);
  const [selected, setSelected] = useState<string | undefined>(initialSelected);
  const [fleetId, setFleetId] = useState("work");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const item = items.find((candidate) => candidate.id === selected);

  const list =
    section === "missions" ? (
      <>
        <SectionHeading title="Missions" scope={null} onScope={() => {}} />
        <ul className="console-story-list" aria-label="Tasks">
          {items.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                aria-current={candidate.id === selected ? "true" : undefined}
                onClick={() => setSelected(candidate.id)}
              >
                {candidate.title}
              </button>
            </li>
          ))}
        </ul>
      </>
    ) : (
      <>
        <SectionHeading
          title={sectionNames[section]}
          scope={null}
          onScope={() => {}}
        />
        <p className="console-empty">
          {sectionPurposes[section]}. Built in a later step.
        </p>
      </>
    );

  return (
    <div style={{ width, height, outline: "1px dashed #5b6b8c" }}>
      <ConsoleFrame
        initialWidth={width}
        fleets={storyFleets}
        fleetId={fleetId}
        score={21}
        relay={relay}
        section={section}
        counts={{ beam: 3, radar: 5 }}
        settingsOpen={settingsOpen}
        settings={
          <>
            <SectionHeading title="Settings" scope={null} onScope={() => {}} />
            <p className="console-empty">
              The existing settings screen opens here.
            </p>
          </>
        }
        list={list}
        detail={
          item && section === "missions" ? (
            <article aria-label="Task">
              <h2 className="console-story-title">{item.title}</h2>
              <p>{item.summary ?? "No summary."}</p>
            </article>
          ) : null
        }
        onFleetChange={setFleetId}
        onSelectSection={(next) => {
          setSection(next);
          setSelected(undefined);
          setSettingsOpen(false);
        }}
        onBack={() => setSelected(undefined)}
        onSettings={() => setSettingsOpen((open) => !open)}
      />
      <style>{`
        .console-story-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
        .console-story-list button { width: 100%; min-height: 44px; padding: 8px 12px; text-align: left;
          border: 1px solid var(--line); border-radius: 8px; background: var(--card); }
        .console-story-list button[aria-current="true"] { border-color: var(--amber); }
        .console-story-title { margin: 0 0 8px; font: 600 16px/1.3 var(--face-heading); }
      `}</style>
    </div>
  );
}
