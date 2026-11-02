import { formatAgo } from "../format";
import { requestTone, type CommanderRequest } from "../requests/model";

export interface RequestLineProps {
  request: CommanderRequest | null;
  now: Date;
}

/** A task's newest Commander request: what and where it is, its summary, and when. */
export function RequestLine({ request, now }: RequestLineProps) {
  if (!request) return null;
  return (
    <div className="sub cmd">
      <span className={`tag ${requestTone(request.state)}`}>
        {request.action} · {request.state}
      </span>
      {request.summary && <span>{request.summary}</span>}
      {request.updatedAt && (
        <span
          className="ago"
          title={new Date(request.updatedAt).toLocaleString("en-GB")}
        >
          {formatAgo(new Date(request.updatedAt), now)}
        </span>
      )}
    </div>
  );
}
