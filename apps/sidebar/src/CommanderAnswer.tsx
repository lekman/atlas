import {
  AskForm,
  answerOptions,
  askKey,
  askText,
  type WaitingItem,
} from "@atlas/ui/sidebar";

import type { Commander } from "./useCommander";

export interface CommanderAnswerProps {
  /** The ask that waits on the operator. */
  item: WaitingItem;
  commander: Commander;
  /** The operator's name, as asks addressed to them begin with it. */
  operator: string;
}

/** The answer form for an ask, with what happened to the last answer sent. */
export function CommanderAnswer({
  item,
  commander,
  operator,
}: CommanderAnswerProps) {
  const sent = commander.latest(askKey(item) ?? undefined);
  const last = sent?.action === "answer" ? sent : null;
  const from =
    item.kind === "commander" && item.worker ? item.worker : "Commander";
  const ask = askText(item, operator).ask;
  return (
    <AskForm
      key={askKey(item) ?? item.ask}
      ask={ask}
      from={from}
      options={answerOptions(item, ask)}
      context={{ detail: item.detail, reason: item.reason }}
      busy={last?.state === "sending"}
      sent={
        last && last.state !== "sending" && last.state !== "failed"
          ? { at: last.requestedAt, answer: last.answer ?? {} }
          : null
      }
      status={
        !last || last.state === "sending"
          ? null
          : last.state === "failed"
            ? { tone: "bad", text: last.summary || "Not sent." }
            : last.state === "done" || last.state === "answered"
              ? {
                  tone: "ok",
                  text: last.summary || `${from} has your answer.`,
                }
              : {
                  tone: "warn",
                  text: last.summary || `Sent; Commander hands it to ${from}.`,
                }
      }
      onSend={(answer) => {
        commander.answer(item, answer).catch(() => undefined);
      }}
    />
  );
}
