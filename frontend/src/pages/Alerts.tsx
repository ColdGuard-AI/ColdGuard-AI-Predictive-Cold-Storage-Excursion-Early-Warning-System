import { BellRing } from "lucide-react";
import { useState } from "react";
import { AlertDetail, AlertRow, useAcknowledge } from "../components/alerts";
import { Card, EmptyState, ErrorState, LoadingState, Segmented, StaleBanner } from "../components/ui";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { api } from "../services/api";
import type { Alert, Severity } from "../types/api";

type AckFilter = "all" | "open" | "acked";
type StateFilter = "all" | "active" | "resolved";

export default function Alerts() {
  const { zones } = useApp();
  const [severity, setSeverity] = useState<Severity | "">("");
  const [zoneId, setZoneId] = useState("");
  const [ack, setAck] = useState<AckFilter>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [openAlert, setOpenAlert] = useState<Alert | null>(null);

  const alerts = usePolling(
    () =>
      api.alerts({
        severity,
        zone_id: zoneId || undefined,
        acknowledged: ack === "all" ? undefined : ack === "acked",
        active: state === "all" ? undefined : state === "active",
        limit: 200,
      }),
    2500,
    [severity, zoneId, ack, state],
  );
  const { acknowledge, pending } = useAcknowledge((a) => {
    void alerts.refresh();
    if (openAlert?.id === a.id) setOpenAlert(a);
  });
  const zoneName = (id: string) => zones?.find((z) => z.zone_id === id)?.name;
  const unacked = alerts.data?.filter((a) => !a.acknowledged) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg"><BellRing size={20} className="text-neon" /> Alert History</h1>
        <p className="text-sm text-fg-muted">
          Alerts are de-duplicated: one record per condition while it persists, re-activated (not duplicated) if it returns within the cooldown.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Severity | "">
          label="Severity"
          value={severity}
          onChange={setSeverity}
          options={[{ value: "", label: "All severities" }, { value: "critical", label: "Critical" }, { value: "warning", label: "Warning" }, { value: "info", label: "Info" }]}
        />
        <Segmented<AckFilter>
          label="Acknowledgement"
          value={ack}
          onChange={setAck}
          options={[{ value: "all", label: "All" }, { value: "open", label: "Unacknowledged" }, { value: "acked", label: "Acknowledged" }]}
        />
        <Segmented<StateFilter>
          label="Condition state"
          value={state}
          onChange={setState}
          options={[{ value: "all", label: "Any state" }, { value: "active", label: "Active" }, { value: "resolved", label: "Resolved" }]}
        />
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          Zone
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-sm text-fg focus:border-neon/40 focus:outline-none"
          >
            <option value="">All zones</option>
            {zones?.map((z) => <option key={z.zone_id} value={z.zone_id}>{z.name}</option>)}
          </select>
        </label>
      </div>
      <StaleBanner error={alerts.data ? alerts.error : null} />

      <Card
        title={`${alerts.data?.length ?? 0} alerts`}
        actions={
          unacked.length > 1 ? (
            <span className="text-xs text-fg-muted">{unacked.length} unacknowledged</span>
          ) : undefined
        }
      >
        {alerts.loading && !alerts.data ? (
          <LoadingState />
        ) : alerts.error && !alerts.data ? (
          <ErrorState message={alerts.error} onRetry={alerts.refresh} />
        ) : !alerts.data?.length ? (
          <EmptyState title="No alerts match these filters" hint="Activate a scenario on the dashboard to generate alerts." />
        ) : (
          <ul className="space-y-2">
            {alerts.data.map((a) => (
              <AlertRow key={a.id} alert={a} zoneName={zoneName(a.zone_id)} onOpen={setOpenAlert} onAck={acknowledge} ackPending={pending === a.id} />
            ))}
          </ul>
        )}
      </Card>

      {openAlert && (
        <AlertDetail
          alert={openAlert}
          zoneName={zoneName(openAlert.zone_id)}
          onClose={() => setOpenAlert(null)}
          onAck={acknowledge}
          ackPending={pending === openAlert.id}
        />
      )}
    </div>
  );
}
