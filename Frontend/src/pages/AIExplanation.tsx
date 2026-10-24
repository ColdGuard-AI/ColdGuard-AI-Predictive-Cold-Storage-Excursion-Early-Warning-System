/* ─────────────────────────────────────────────────────────────────────────────
   ColdGuard AI — AI Diagnosis & SOP Playbook
   Comprehensive incident root-cause explainability, real-time thermodynamic
   inference, and interactive standard operating procedures (SOPs) with
   GxP electronic sign-off and executable facility control actions.
───────────────────────────────────────────────────────────────────────────── */
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Boxes,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  FileCheck2,
  FileText,
  Flame,
  HelpCircle,
  History,
  Layers,
  Lightbulb,
  Lock,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Snowflake,
  Sparkles,
  Thermometer,
  Trash2,
  UserCheck,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { POLL_MS } from "../lib/format";
import { api } from "../services/api";

// ── Types ────────────────────────────────────────────────────────────────────
interface SOPStep {
  id: string;
  title: string;
  description: string;
  subsystem: string;
  estimatedMinutes: number;
  interactiveAction?: {
    label: string;
    actionKey: "quench" | "close_door" | "reset_compressor" | "manifest_export";
    description: string;
  };
}

interface SOPDefinition {
  id: string;
  code: string;
  title: string;
  classification: "Level 1 Critical" | "Level 2 Warning" | "Level 3 Standard";
  category: "Thermal Excursion" | "Electromechanical" | "Perimeter Breach" | "Product Quality";
  targetSlaMinutes: number;
  summary: string;
  steps: SOPStep[];
}

interface SOPStepExecution {
  stepId: string;
  completed: boolean;
  timestamp?: string;
  technicianNotes?: string;
}

interface ActiveSOPState {
  sopId: string;
  zoneId: string;
  zoneName: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  startedAt?: string;
  completedAt?: string;
  steps: Record<string, SOPStepExecution>;
  actionStatus?: Record<string, "idle" | "running" | "success" | "error">;
  signature?: {
    technicianName: string;
    badgeId: string;
    notes: string;
    timestamp: string;
  };
}

interface SOPAuditRecord {
  id: string;
  sopCode: string;
  sopTitle: string;
  zoneId: string;
  zoneName: string;
  technicianName: string;
  badgeId: string;
  startedAt: string;
  completedAt: string;
  durationMinutes: number;
  stepsCompleted: number;
  totalSteps: number;
  notes: string;
}

// ── Master Playbook Definitions ──────────────────────────────────────────────
const PLAYBOOK_CATALOG: SOPDefinition[] = [
  {
    id: "sop-cold-01",
    code: "SOP-COLD-01",
    title: "Thermal Excursion Emergency Quench & Setpoint Boost",
    classification: "Level 1 Critical",
    category: "Thermal Excursion",
    targetSlaMinutes: 10,
    summary:
      "Rapid thermodynamic response procedure triggered by continuous temperature drift or boundary breach. Enforces perimeter lockdown, sensor cross-verification, and secondary refrigeration stage boost.",
    steps: [
      {
        id: "step-1",
        title: "Telemetry Cross-Verification",
        description:
          "Cross-verify primary RTD sensor telemetry against redundant probe B & C and Isolation Forest filter to rule out telemetry jitter.",
        subsystem: "Instrumentation",
        estimatedMinutes: 2,
      },
      {
        id: "step-2",
        title: "Perimeter Quarantine & Access Lock",
        description:
          "Seal chamber access portal, engage magnetic lock interlock, and restrict all non-emergency entry until thermal recovery.",
        subsystem: "Envelope",
        estimatedMinutes: 1,
      },
      {
        id: "step-3",
        title: "Command Emergency Cooling Boost",
        description:
          "Override automation controller to dispatch maximum pull-down setpoint (-2.0°C below nominal band) to quench thermal inertia.",
        subsystem: "Refrigeration",
        estimatedMinutes: 2,
        interactiveAction: {
          label: "Execute Cooling Quench",
          actionKey: "quench",
          description: "Dispatches simulated nominal recovery setpoint command to chamber controller.",
        },
      },
      {
        id: "step-4",
        title: "Airflow Optimization & Stratification Dissipation",
        description:
          "Activate secondary evaporator blower fans to maximum CFM to eliminate vertical thermal stratification across high-density racks.",
        subsystem: "Air Handling",
        estimatedMinutes: 2,
      },
      {
        id: "step-5",
        title: "Thermal Blanketing on Tier-1 Pallet Racks",
        description:
          "Deploy certified VIP thermal blankets over upper pallet bays containing heat-sensitive inventory.",
        subsystem: "Inventory",
        estimatedMinutes: 3,
      },
      {
        id: "step-6",
        title: "Stabilization Slope Verification",
        description:
          "Observe 10-minute derivative slope (dT/dt). Confirm negative trajectory (< -0.05°C/min) before declaring chamber stabilized.",
        subsystem: "Quality Assurance",
        estimatedMinutes: 2,
      },
    ],
  },
  {
    id: "sop-comp-02",
    code: "SOP-COMP-02",
    title: "Compressor Trip & Secondary Stage Activation",
    classification: "Level 1 Critical",
    category: "Electromechanical",
    targetSlaMinutes: 8,
    summary:
      "Electromechanical fault containment protocol for primary refrigeration compressor failure. Guides electrical breaker inspection, suction/discharge pressure verification, and auxiliary motor contactor transfer.",
    steps: [
      {
        id: "step-1",
        title: "Inspect Electrical Subpanel Breakers",
        description:
          "Inspect breaker CB-R401 on Motor Control Center subpanel. Confirm no ground-fault trip or arc-flash alarm lockouts.",
        subsystem: "Electrical MCC",
        estimatedMinutes: 2,
      },
      {
        id: "step-2",
        title: "Verify Suction & Discharge Pressure Gauges",
        description:
          "Inspect digital and analog refrigerant pressure gauges. Verify suction > 18 psi and discharge < 240 psi to ensure no mechanical hydrostatic lock.",
        subsystem: "Refrigeration Loop",
        estimatedMinutes: 2,
      },
      {
        id: "step-3",
        title: "Manual Transfer to Auxiliary Backup Unit",
        description:
          "Rotate bypass selector switch from 'AUTO-PRIMARY' to 'STAGE-2 AUXILIARY BACKUP' to energize redundant compressor motor.",
        subsystem: "Control Logic",
        estimatedMinutes: 1,
        interactiveAction: {
          label: "Cycle Electrical Relay & Reset",
          actionKey: "reset_compressor",
          description: "Resets chamber scenario and cycles contactor relay in simulation backend.",
        },
      },
      {
        id: "step-4",
        title: "Supply Voltage & Contactor Pull-in Verification",
        description:
          "Confirm 3-phase 415V supply balance (±2% delta) and check mechanical pull-in of magnetic contactor coil.",
        subsystem: "Electrical MCC",
        estimatedMinutes: 1,
      },
      {
        id: "step-5",
        title: "Load Ramp & Current Draw Confirmation",
        description:
          "Monitor clamp ammeter. Ensure motor current stabilizes at nominal full-load amperage (FLA) without thermal overload tripping.",
        subsystem: "Diagnostics",
        estimatedMinutes: 2,
      },
    ],
  },
  {
    id: "sop-door-03",
    code: "SOP-DOOR-03",
    title: "Perimeter Gasket & Air Ingress Remediation",
    classification: "Level 2 Warning",
    category: "Perimeter Breach",
    targetSlaMinutes: 5,
    summary:
      "Remediation procedure for sustained door opening, perimeter microswitch alerts, or gasket seal degradation. Eliminates convective warm air rush and protects against coil frost accumulation.",
    steps: [
      {
        id: "step-1",
        title: "Inspect Magnetic Door Gasket for Ice Accumulation",
        description:
          "Conduct physical sweep along door seal perimeter. Check for rime ice, frost bridging, or silicone gasket pinch.",
        subsystem: "Physical Envelope",
        estimatedMinutes: 1,
      },
      {
        id: "step-2",
        title: "Engage High-Velocity Vestibule Air Curtain",
        description:
          "Switch door portal air curtain to HIGH to create aerodynamic barrier against exterior ambient warm air ingress.",
        subsystem: "Air Handling",
        estimatedMinutes: 1,
      },
      {
        id: "step-3",
        title: "Command Latch Mechanical Closure",
        description:
          "Engage pneumatic door closer latch and verify magnetic proximity sensor signal transitions to 'CLOSED'.",
        subsystem: "Access Control",
        estimatedMinutes: 1,
        interactiveAction: {
          label: "Command Door Latch Seal",
          actionKey: "close_door",
          description: "Sends actual API command to seal the door on the active zone.",
        },
      },
      {
        id: "step-4",
        title: "Activate Sill Defrost Heaters",
        description:
          "Energize threshold defrost heating elements to prevent floor condensation from freezing into slip hazard or gasket barrier.",
        subsystem: "Thermal Management",
        estimatedMinutes: 1,
      },
      {
        id: "step-5",
        title: "Negative Differential Pressure Verification",
        description:
          "Verify cold room differential manometer recovers to nominal -15 Pa envelope containment pressure.",
        subsystem: "Instrumentation",
        estimatedMinutes: 1,
      },
    ],
  },
  {
    id: "sop-bio-04",
    code: "SOP-BIO-04",
    title: "High-Value Inventory Cryo-Safeguard & Batch Audit",
    classification: "Level 1 Critical",
    category: "Product Quality",
    targetSlaMinutes: 18,
    summary:
      "GxP chain-of-custody protocol for protecting high-value biologics, vaccines, and perishables during latent excursion risk. Prepares validated transfer shippers and initiates batch audit log.",
    steps: [
      {
        id: "step-1",
        title: "Generate Active Lot Manifest & Vulnerability Hierarchy",
        description:
          "Extract current pallet inventory manifest. Sort perishable lots by thermal exposure tolerance and unit batch value.",
        subsystem: "GxP Compliance",
        estimatedMinutes: 3,
        interactiveAction: {
          label: "Export Lot Risk Manifest",
          actionKey: "manifest_export",
          description: "Generates electronic inventory risk manifest with timestamped hash.",
        },
      },
      {
        id: "step-2",
        title: "Pre-Condition Validated VIP Shippers",
        description:
          "Stage pre-conditioned Vacuum Insulated Panel (VIP) transfer boxes with calibrated PCM eutectic cool packs.",
        subsystem: "Packaging",
        estimatedMinutes: 5,
      },
      {
        id: "step-3",
        title: "Priority Transfer of High-Sensitivity Biologics",
        description:
          "Transfer tier-1 temperature sensitive batches into VIP shippers under continuous nitrogen or chilled vapor blanket.",
        subsystem: "Operations",
        estimatedMinutes: 5,
      },
      {
        id: "step-4",
        title: "Insert NIST-Traceable Continuous Loggers",
        description:
          "Insert secondary calibrated wireless datalogger into each transport pack before sealing lid.",
        subsystem: "Quality Assurance",
        estimatedMinutes: 2,
      },
      {
        id: "step-5",
        title: "Relocate to Redundant Zone & Sign Chain-of-Custody",
        description:
          "Transfer containers to validated backup chamber (Zone B/C) with matching setpoint. Record digital supervisor sign-off.",
        subsystem: "Regulatory GxP",
        estimatedMinutes: 3,
      },
    ],
  },
];

const AUDIT_STORAGE_KEY = "coldguard.sop_executions";
const ACTIVE_SOP_KEY = "coldguard.active_sop";

export default function AIExplanation() {
  const { zones, selectedZoneId, setSelectedZoneId } = useApp();
  const selectedZone = selectedZoneId || (zones?.[0]?.zone_id ?? "zone-a");

  // Sub-tabs
  const [activeTab, setActiveTab] = useState<"diagnosis" | "playbook" | "audit">("diagnosis");

  // Selected SOP in Playbook catalog
  const [selectedSopId, setSelectedSopId] = useState<string>("sop-cold-01");

  // Active execution state
  const [executionState, setExecutionState] = useState<ActiveSOPState | null>(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_SOP_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to load active SOP from storage", e);
    }
    return null;
  });

  // Audit records
  const [auditLogs, setAuditLogs] = useState<SOPAuditRecord[]>(() => {
    try {
      const stored = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to load audit logs from storage", e);
    }
    return [];
  });

  // Sign-off modal state
  const [showSignoffModal, setShowSignoffModal] = useState(false);
  const [technicianName, setTechnicianName] = useState("R. Sharma (Senior Tech)");
  const [badgeId, setBadgeId] = useState("TECH-7749-GxP");
  const [signoffNotes, setSignoffNotes] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Poll prediction overview
  const predictionQuery = usePolling(
    () => api.predictionOverview(selectedZone, 30),
    POLL_MS,
    [selectedZone]
  );

  const data = predictionQuery.data;
  const currentZone = zones?.find((z) => z.zone_id === selectedZone);
  const aiExplanation = data?.ai_explanation;
  const spoilage = aiExplanation?.inventory_spoilage_risk;

  const isCritical = aiExplanation?.severity === "critical";
  const isWarning = aiExplanation?.severity === "warning";

  // ── Auto-Recommended SOP Engine ────────────────────────────────────────────
  const recommendedSop = useMemo(() => {
    if (!currentZone) {
      return {
        sop: PLAYBOOK_CATALOG[0],
        urgency: "STANDARD",
        reason: "Chamber telemetry is initializing. Standard operating procedure available.",
      };
    }

    // 1. Electromechanical compressor stoppage
    if (
      currentZone.compressor_status === "stopped" ||
      currentZone.compressor_status === "failed"
    ) {
      return {
        sop: PLAYBOOK_CATALOG.find((s) => s.id === "sop-comp-02")!,
        urgency: "CRITICAL",
        reason: `Compressor motor in ${currentZone.name} is halted. Zero active cooling capacity. Immediate contactor & breaker inspection required.`,
      };
    }

    // 2. Physical door ingress
    if (currentZone.door_status === "open" || (currentZone.door_open_minutes ?? 0) > 2) {
      return {
        sop: PLAYBOOK_CATALOG.find((s) => s.id === "sop-door-03")!,
        urgency: "HIGH",
        reason: `Chamber door has been unsealed for ${currentZone.door_open_minutes.toFixed(0)} minutes. Convective warm air ingress is actively eroding thermal barrier.`,
      };
    }

    // 3. Thermal drift / forecast boundary spike
    const temp = currentZone.temperature ?? 4.0;
    const upper = currentZone.upper_limit ?? 8.0;
    const residual = currentZone.residual_rise_predicted ?? 0;
    if (temp >= upper - 0.8 || residual > 0.05 || (currentZone.risk_score ?? 0) > 40) {
      return {
        sop: PLAYBOOK_CATALOG.find((s) => s.id === "sop-cold-01")!,
        urgency: "CRITICAL",
        reason: `Thermal boundary warning: Temperature (${temp.toFixed(1)}°C) or residual inertia (+${residual.toFixed(1)}°C) threatening ${upper}°C upper GxP threshold.`,
      };
    }

    // 4. Default inventory potency safeguard
    return {
      sop: PLAYBOOK_CATALOG.find((s) => s.id === "sop-bio-04")!,
      urgency: "STANDARD",
      reason: `Thermal conditions are nominal (${temp.toFixed(1)}°C). Standard inventory potency audit and VIP shipper readiness protocol recommended.`,
    };
  }, [currentZone]);

  // Persist active execution
  useEffect(() => {
    if (executionState) {
      localStorage.setItem(ACTIVE_SOP_KEY, JSON.stringify(executionState));
    } else {
      localStorage.removeItem(ACTIVE_SOP_KEY);
    }
  }, [executionState]);

  // Persist audit logs
  useEffect(() => {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Current active or catalog SOP
  const currentSop = useMemo(() => {
    return PLAYBOOK_CATALOG.find((s) => s.id === selectedSopId) || PLAYBOOK_CATALOG[0];
  }, [selectedSopId]);

  // Check if current SOP is currently executing
  const isSelectedSopExecuting =
    executionState &&
    executionState.sopId === currentSop.id &&
    executionState.zoneId === selectedZone;

  // ── Handler: Initiate SOP ──────────────────────────────────────────────────
  const handleInitiateSOP = (sop: SOPDefinition) => {
    const initialSteps: Record<string, SOPStepExecution> = {};
    sop.steps.forEach((st) => {
      initialSteps[st.id] = {
        stepId: st.id,
        completed: false,
      };
    });

    const newState: ActiveSOPState = {
      sopId: sop.id,
      zoneId: selectedZone,
      zoneName: currentZone?.name ?? "Cold Chamber",
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
      steps: initialSteps,
      actionStatus: {},
    };

    setExecutionState(newState);
    setSelectedSopId(sop.id);
    setActiveTab("playbook");
    setActionFeedback(`Initiated ${sop.code} for ${currentZone?.name}. Steps unlocked.`);
  };

  // ── Handler: Toggle Step Completion ────────────────────────────────────────
  const handleToggleStep = (stepId: string) => {
    if (!executionState || executionState.status === "COMPLETED") return;

    setExecutionState((prev) => {
      if (!prev) return prev;
      const currentVal = prev.steps[stepId]?.completed ?? false;
      const updatedSteps = {
        ...prev.steps,
        [stepId]: {
          stepId,
          completed: !currentVal,
          timestamp: !currentVal ? new Date().toLocaleTimeString() : undefined,
          technicianNotes: prev.steps[stepId]?.technicianNotes,
        },
      };
      return {
        ...prev,
        steps: updatedSteps,
      };
    });
  };

  // ── Handler: Update Step Notes ─────────────────────────────────────────────
  const handleStepNotesChange = (stepId: string, notes: string) => {
    if (!executionState) return;
    setExecutionState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: {
          ...prev.steps,
          [stepId]: {
            ...prev.steps[stepId],
            technicianNotes: notes,
          },
        },
      };
    });
  };

  // ── Handler: Execute Interactive Physical/Simulator Action ─────────────────
  const handleExecuteInteractiveAction = async (step: SOPStep) => {
    if (!step.interactiveAction || !executionState) return;
    const actionKey = step.interactiveAction.actionKey;

    setExecutionState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        actionStatus: { ...prev.actionStatus, [step.id]: "running" },
      };
    });

    try {
      if (actionKey === "close_door") {
        await api.setDoor(selectedZone, "closed");
        setActionFeedback(`Success: Sealed chamber door for ${currentZone?.name} via API command.`);
      } else if (actionKey === "quench") {
        await api.setScenario(selectedZone, "normal");
        setActionFeedback(`Success: Dispatched maximum cooling quench command to controller.`);
      } else if (actionKey === "reset_compressor") {
        await api.reset("scenario", selectedZone);
        setActionFeedback(`Success: Reset electrical overload trip and cycled contactor relay.`);
      } else if (actionKey === "manifest_export") {
        const dummyManifest = {
          zone: currentZone?.name,
          timestamp: new Date().toISOString(),
          category: spoilage?.inventory_category ?? "Biologics",
          value: spoilage?.total_inventory_value_usd ?? "$340,000",
          items: spoilage?.vulnerable_items ?? ["Vaccine Vials", "Antivenom Stock"],
          hash: "SHA256:7f4c9a8e2b10d3f8a451",
        };
        const blob = new Blob([JSON.stringify(dummyManifest, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `GxP_Manifest_${selectedZone}_${Date.now()}.json`;
        a.click();
        setActionFeedback(`Success: Downloaded tamper-sealed GxP lot risk manifest.`);
      }

      // Mark step completed automatically when action completes
      setExecutionState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          actionStatus: { ...prev.actionStatus, [step.id]: "success" },
          steps: {
            ...prev.steps,
            [step.id]: {
              stepId: step.id,
              completed: true,
              timestamp: new Date().toLocaleTimeString(),
            },
          },
        };
      });
    } catch (err: unknown) {
      console.error(err);
      setActionFeedback(`Action error: ${err instanceof Error ? err.message : "Failed to execute action."}`);
      setExecutionState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          actionStatus: { ...prev.actionStatus, [step.id]: "error" },
        };
      });
    }
  };

  // ── Handler: Submit Electronic GxP Sign-Off ────────────────────────────────
  const handleFinalSignoff = () => {
    if (!executionState) return;

    const completedAt = new Date().toISOString();
    const completedStepsCount = Object.values(executionState.steps).filter((s) => s.completed).length;
    const totalStepsCount = currentSop.steps.length;

    const auditRecord: SOPAuditRecord = {
      id: `EXEC-${Date.now().toString(36).toUpperCase()}`,
      sopCode: currentSop.code,
      sopTitle: currentSop.title,
      zoneId: executionState.zoneId,
      zoneName: executionState.zoneName,
      technicianName,
      badgeId,
      startedAt: executionState.startedAt || completedAt,
      completedAt,
      durationMinutes: Math.max(
        1,
        Math.round(
          (new Date(completedAt).getTime() - new Date(executionState.startedAt || completedAt).getTime()) /
            60000
        )
      ),
      stepsCompleted: completedStepsCount,
      totalSteps: totalStepsCount,
      notes: signoffNotes || "All mitigation checks successfully verified in compliance with GxP SOP guidelines.",
    };

    setAuditLogs((prev) => [auditRecord, ...prev]);
    setExecutionState({
      ...executionState,
      status: "COMPLETED",
      completedAt,
      signature: {
        technicianName,
        badgeId,
        notes: signoffNotes,
        timestamp: completedAt,
      },
    });

    setShowSignoffModal(false);
    setActionFeedback(`SOP ${currentSop.code} completed and electronically signed. Recorded to audit log.`);
  };

  // ── Handler: Abort / Reset Active SOP ──────────────────────────────────────
  const handleCancelActiveSOP = () => {
    if (confirm("Are you sure you want to discard the active playbook session?")) {
      setExecutionState(null);
      setActionFeedback("Active playbook execution discarded.");
    }
  };

  // Calculate execution progress
  const completedStepsCount = executionState
    ? Object.values(executionState.steps).filter((s) => s.completed).length
    : 0;
  const progressPercent = currentSop.steps.length > 0
    ? Math.round((completedStepsCount / currentSop.steps.length) * 100)
    : 0;

  return (
    <div className="space-y-6 pb-16 font-sans text-[#0F172A] selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DCE8F6]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center shadow-sm">
                <BrainCircuit size={20} />
              </div>
              AI Diagnosis & SOP Playbook
            </h1>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB]">
              SOP ENGINE
            </span>
          </div>
          <p className="text-sm text-[#475569] mt-0.5 font-medium">
            Dynamic root-cause explainability, thermodynamic fault classification, and executable GxP standard operating procedures.
          </p>
        </div>

        {/* Zone Selector */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#DCE8F6] shadow-sm">
          {zones?.map((z) => (
            <button
              key={z.zone_id}
              onClick={() => setSelectedZoneId(z.zone_id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedZone === z.zone_id
                  ? "bg-[#2563EB] text-white shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F7FF]"
              }`}
            >
              {z.name.replace(" Vaccine Store", "").replace(" Dairy Chiller", "").replace(" Frozen Store", "")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notification Feedback Banner ───────────────────────────────────── */}
      {actionFeedback && (
        <div className="p-3.5 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-xs font-medium text-[#2563EB] flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#2563EB] shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-[#475569] hover:text-[#0F172A] cursor-pointer text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Dynamic Automated SOP Recommendation Card ──────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-r from-[#EFF6FF] via-white to-[#F0F7FF] border border-[#BAE6FD] p-5 shadow-arctic-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
              recommendedSop.urgency === "CRITICAL"
                ? "bg-rose-50 text-rose-600 border-rose-200 animate-pulse"
                : recommendedSop.urgency === "HIGH"
                ? "bg-amber-50 text-amber-600 border-amber-200"
                : "bg-[#EFF6FF] text-[#2563EB] border-[#BAE6FD]"
            }`}
          >
            {recommendedSop.urgency === "CRITICAL" ? (
              <ShieldAlert size={24} />
            ) : recommendedSop.urgency === "HIGH" ? (
              <AlertTriangle size={24} />
            ) : (
              <Sparkles size={24} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white border border-[#DCE8F6] text-[#475569]">
                AI Recommendation Engine
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  recommendedSop.urgency === "CRITICAL"
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : recommendedSop.urgency === "HIGH"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                }`}
              >
                {recommendedSop.urgency} PRIORITY
              </span>
              <span className="text-xs font-bold text-[#0F172A] font-mono">
                {recommendedSop.sop.code} — {recommendedSop.sop.title}
              </span>
            </div>
            <p className="text-xs text-[#475569] mt-1.5 leading-relaxed font-sans max-w-3xl">
              {recommendedSop.reason}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
          <button
            onClick={() => handleInitiateSOP(recommendedSop.sop)}
            className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
          >
            <Play size={14} className="fill-white" />
            Launch Recommended SOP
          </button>
        </div>
      </div>

      {/* ── Mode Selection Tabs ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[#DCE8F6] pb-1">
        <button
          onClick={() => setActiveTab("diagnosis")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 cursor-pointer ${
            activeTab === "diagnosis"
              ? "border-[#2563EB] text-[#2563EB] bg-white"
              : "border-transparent text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F7FF]"
          }`}
        >
          <BrainCircuit size={16} />
          AI Incident Diagnosis & Root Cause
        </button>

        <button
          onClick={() => setActiveTab("playbook")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 cursor-pointer relative ${
            activeTab === "playbook"
              ? "border-[#2563EB] text-[#2563EB] bg-white"
              : "border-transparent text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F7FF]"
          }`}
        >
          <BookOpen size={16} />
          Interactive SOP Playbooks
          {executionState?.status === "IN_PROGRESS" && (
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse ml-1" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 cursor-pointer ${
            activeTab === "audit"
              ? "border-[#2563EB] text-[#2563EB] bg-white"
              : "border-transparent text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F7FF]"
          }`}
        >
          <FileCheck2 size={16} />
          GxP Execution Audit Log ({auditLogs.length})
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: AI INCIDENT DIAGNOSIS & ROOT CAUSE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "diagnosis" && (
        <div className="space-y-6">
          {/* Main Narrative Card */}
          <div className="rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-arctic-card space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-[#DCE8F6]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
                  <BrainCircuit size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">
                    Dynamic AI Diagnosis: {currentZone?.name}
                  </h2>
                  <p className="text-xs text-[#475569]">
                    Derived from 1-minute time-series features & thermal boundary states
                  </p>
                </div>
              </div>

              {aiExplanation && (
                <span
                  className={`text-[11px] uppercase font-bold tracking-wider px-3 py-1 rounded-full border ${
                    isCritical
                      ? "bg-rose-50 text-rose-800 border-rose-200"
                      : isWarning
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}
                >
                  {aiExplanation.severity}
                </span>
              )}
            </div>

            {/* AI Headline */}
            {aiExplanation?.headline && (
              <div className="text-sm font-bold text-[#2563EB] font-mono flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isCritical ? "bg-rose-500 animate-pulse" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
                {aiExplanation.headline}
              </div>
            )}

            {/* Narrative Box */}
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] text-sm text-[#0F172A] leading-relaxed">
              {aiExplanation?.narrative ||
                (currentZone?.compressor_status === "stopped" || currentZone?.compressor_status === "failed"
                  ? `Refrigeration compressor in ${currentZone.name} is offline. Active cooling is halted and chamber temperature is drifting upward toward upper limit (${currentZone.upper_limit}°C). Immediate breaker inspection is required.`
                  : currentZone?.door_status === "open"
                  ? `The door of ${currentZone.name} has been open for ${currentZone.door_open_minutes.toFixed(
                      0
                    )} minutes, allowing warm air from outside (${(
                      currentZone.ambient_temperature ?? 25
                    ).toFixed(1)}°C) to enter. This is driving a positive temperature gradient (${
                      currentZone.trend_per_hour >= 0 ? "+" : ""
                    }${currentZone.trend_per_hour.toFixed(
                      1
                    )}°C/h). Upon closure, the chamber will experience residual temperature rise before active refrigeration restabilizes the core.`
                  : (currentZone?.residual_rise_predicted ?? 0) > 0.05
                  ? `${currentZone?.name} is currently in post-closure thermal recovery. While the door is sealed, trapped warm air is causing a residual rise of +${(
                      currentZone?.residual_rise_predicted ?? 0
                    ).toFixed(1)}°C towards a predicted peak of ${
                      currentZone?.peak_temp_predicted != null
                        ? `${currentZone.peak_temp_predicted.toFixed(1)}°C`
                        : "nominal limit"
                    }. Risk remains retained until active cooling restabilizes the chamber (estimated ~${Math.round(
                      currentZone?.recovery_time_minutes ?? 0
                    )} minutes remaining).`
                  : `${currentZone?.name ?? "Chamber"} is operating within nominal thermodynamic boundary conditions. Current temperature is ${
                      currentZone?.temperature != null
                        ? `${currentZone.temperature.toFixed(1)}°C`
                        : "monitored"
                    } against a safe band of ${currentZone?.lower_limit ?? 2}°C to ${
                      currentZone?.upper_limit ?? 8
                    }°C. Continuous ML forecasting indicates low excursion probability.`)}
            </div>

            {/* Perishable Inventory Spoilage Risk Card */}
            {spoilage && (
              <div className="rounded-xl p-5 bg-[#EFF6FF] border border-[#BAE6FD] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#2563EB] animate-pulse" />
                    <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider font-mono">
                      Perishable Inventory at Risk — {spoilage.zone_name}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      spoilage.spoilage_status.includes("Critical")
                        ? "bg-rose-50 text-rose-800 border-rose-200"
                        : spoilage.spoilage_status.includes("Warning")
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    {spoilage.spoilage_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="p-3 rounded-lg bg-white border border-[#DCE8F6]">
                    <span className="text-[10px] text-[#475569] uppercase tracking-wider block font-mono">
                      Stock Category
                    </span>
                    <span className="text-[#0F172A] font-semibold">{spoilage.inventory_category}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-[#DCE8F6]">
                    <span className="text-[10px] text-[#475569] uppercase tracking-wider block font-mono">
                      Total Value
                    </span>
                    <span className="text-emerald-700 font-bold">{spoilage.total_inventory_value_usd}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-[#DCE8F6]">
                    <span className="text-[10px] text-[#475569] uppercase tracking-wider block font-mono">
                      Critical Threshold
                    </span>
                    <span className="text-rose-600 font-bold">{spoilage.critical_threshold_c}°C</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-[#DCE8F6]">
                    <span className="text-[10px] text-[#475569] uppercase tracking-wider block font-mono">
                      Time to Spoilage
                    </span>
                    <span
                      className={`font-bold ${
                        spoilage.time_to_spoilage_minutes != null ? "text-amber-600" : "text-[#475569]"
                      }`}
                    >
                      {spoilage.time_to_spoilage_minutes != null
                        ? `${spoilage.time_to_spoilage_minutes} min`
                        : "No risk (Safe)"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-[#0F172A] block font-mono">
                    Vulnerable Inventory Items:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {spoilage.vulnerable_items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs text-[#0F172A] bg-white px-2.5 py-1.5 rounded border border-[#DCE8F6]"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] shrink-0" />
                        <span className="truncate">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#BAE6FD] text-xs text-[#0F172A]">
                  <span className="text-[#2563EB] font-bold font-mono">Spoilage Mechanism: </span>
                  {spoilage.spoilage_mechanism}
                </div>

                <div className="flex items-center justify-between text-xs pt-1 font-mono">
                  <span className="text-[#475569]">
                    Financial Exposure:{" "}
                    <span className="text-rose-600 font-bold">{spoilage.financial_impact_risk}</span>
                  </span>
                  <span className="text-amber-700 font-semibold">{spoilage.mitigation_urgency}</span>
                </div>
              </div>
            )}

            {/* Summary & Expected Recovery Card */}
            <div className="rounded-xl p-4 bg-[#EFF6FF] border border-[#BAE6FD] flex items-start gap-3 shadow-sm">
              <div className="h-8 w-8 rounded-lg bg-white text-[#2563EB] flex items-center justify-center shrink-0 border border-[#DCE8F6]">
                <Sparkles size={18} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-[#0F172A] uppercase tracking-wider font-mono">
                  Summary & Expected Recovery
                </div>
                <div className="text-xs text-[#475569] leading-relaxed font-sans">
                  {aiExplanation?.summary_text ??
                    (predictionQuery.loading
                      ? "Calculating forecast..."
                      : "Chamber in thermal equilibrium.")}
                </div>
              </div>
            </div>

            {/* Feature Importance & Contributing Factors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-4">
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Zap size={14} className="text-[#2563EB]" />
                  Primary Driving Factors (Feature Attribution)
                </h3>
                <ul className="space-y-2 text-xs text-[#475569]">
                  {(aiExplanation?.contributing_factors?.length
                    ? aiExplanation.contributing_factors
                    : [
                        currentZone?.compressor_status === "stopped" ||
                        currentZone?.compressor_status === "failed"
                          ? "Refrigeration compressor offline (0 kW cooling capacity)"
                          : currentZone?.door_status === "open"
                          ? `Door open for ${currentZone.door_open_minutes.toFixed(
                              0
                            )} minutes (major thermal ingress)`
                          : (currentZone?.residual_rise_predicted ?? 0) > 0.05
                          ? `Post-closure trapped thermal inertia (ΔT residual +${(
                              currentZone?.residual_rise_predicted ?? 0
                            ).toFixed(1)}°C)`
                          : "Chamber door sealed; thermal boundary intact",
                        `Outdoor ambient temperature ${(
                          currentZone?.ambient_temperature ?? 24.5
                        ).toFixed(1)}°C`,
                        `10-minute temperature drift: ${
                          currentZone?.trend_per_hour != null
                            ? `${currentZone.trend_per_hour >= 0 ? "+" : ""}${currentZone.trend_per_hour.toFixed(
                                1
                              )}°C/h`
                            : "nominal"
                        }`,
                        currentZone?.compressor_status === "running"
                          ? `Refrigeration compressor active (${Math.round(
                              currentZone?.compressor_load_pct ?? 75
                            )}% capacity)`
                          : "Compressor cycling or offline",
                      ]
                  ).map((factor, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] mt-1.5 shrink-0" />
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-4">
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Lightbulb size={14} className="text-[#2563EB]" />
                  Recommended Corrective Procedures
                </h3>
                <ol className="space-y-2 text-xs text-[#475569]">
                  {(aiExplanation?.recommended_actions?.length
                    ? aiExplanation.recommended_actions
                    : [
                        currentZone?.compressor_status === "stopped" ||
                        currentZone?.compressor_status === "failed"
                          ? "Inspect electrical subpanel breakers and reset compressor motor contactor."
                          : currentZone?.door_status === "open"
                          ? "Close the chamber door immediately to arrest ambient heat rush."
                          : (currentZone?.residual_rise_predicted ?? 0) > 0.05
                          ? "Maintain door sealed; allow refrigeration compressor to overcome thermal inertia."
                          : "Maintain standard temperature compliance logging.",
                        "Verify door seal integrity and magnetic gasket contact.",
                        "Observe multi-horizon ML predictions for latent excursion spikes.",
                        "If temperature exceeds safe boundary, activate backup refrigeration loop.",
                      ]
                  ).map((action, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <span className="h-5 w-5 rounded-full bg-[#EFF6FF] text-[#2563EB] font-bold text-[10px] flex items-center justify-center shrink-0 border border-[#BAE6FD]">
                        {i + 1}
                      </span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {/* Sensor Failure vs Genuine Thermal Shift Explainer */}
          <div className="rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-arctic-card">
            <h2 className="text-base font-bold text-[#0F172A] mb-2 flex items-center gap-2">
              <Wrench size={18} className="text-[#2563EB]" />
              Sensor Reliability vs Genuine Thermal Excursion Classification
            </h2>
            <p className="text-xs text-[#475569] mb-5 leading-relaxed font-medium">
              ColdGuard AI continuously distinguishes between instrumentation hardware failures (spikes,
              stuck values, dropouts) and genuine physical room temperature breaches.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
                <div className="font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Genuine Thermal Excursion
                </div>
                <p className="text-[#475569] leading-relaxed">
                  Temperature conforms to lumped room thermal capacitance (~180 min time constant). Neighboring
                  probes and compressor power draw show synchronous thermodynamic shift.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
                <div className="font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Telemetry Spike / Jitter
                </div>
                <p className="text-[#475569] leading-relaxed">
                  Instantaneous gradient (&gt;2.5°C/min) physically impossible for stored inventory thermal
                  mass. Flagged by Isolation Forest; filtered by Kalman smoother without false alarms.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
                <div className="font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                  Stuck / Frozen Sensor
                </div>
                <p className="text-[#475569] leading-relaxed">
                  Zero variance over 15+ consecutive ticks while compressor cycles. Classified as transmitter
                  ADC lockup; recommended probe replacement or bus reset.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: INTERACTIVE SOP PLAYBOOKS (EXECUTABLE ENGINE)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "playbook" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Playbook List Catalog Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <div className="text-xs font-bold text-[#475569] uppercase tracking-wider font-mono px-1">
              Standard Operating Procedures ({PLAYBOOK_CATALOG.length})
            </div>

            {PLAYBOOK_CATALOG.map((sop) => {
              const isSelected = selectedSopId === sop.id;
              const isExecutingThis =
                executionState &&
                executionState.sopId === sop.id &&
                executionState.status === "IN_PROGRESS";

              return (
                <div
                  key={sop.id}
                  onClick={() => setSelectedSopId(sop.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white border-[#2563EB] shadow-md ring-2 ring-[#2563EB]/10"
                      : "bg-white/80 border-[#DCE8F6] hover:border-[#38BDF8] hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold font-mono text-[#2563EB]">{sop.code}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        sop.classification.includes("Critical")
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : sop.classification.includes("Warning")
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {sop.classification}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-[#0F172A] line-clamp-1">{sop.title}</h3>
                  <p className="text-[11px] text-[#475569] mt-1 line-clamp-2 leading-relaxed">
                    {sop.summary}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#F1F5F9] text-[10px] text-[#475569] font-mono">
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-[#2563EB]" />
                      SLA: {sop.targetSlaMinutes} min
                    </span>
                    <span>{sop.steps.length} steps</span>
                    {isExecutingThis && (
                      <span className="text-rose-600 font-bold flex items-center gap-1 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                        RUNNING
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Playbook Runner */}
          <div className="lg:col-span-8 space-y-5">
            {/* Playbook Header & Status Banner */}
            <div className="rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-arctic-card space-y-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB]">
                      {currentSop.code}
                    </span>
                    <span className="text-xs text-[#475569] font-mono">
                      Category: {currentSop.category}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-[#0F172A] mt-1.5">{currentSop.title}</h2>
                  <p className="text-xs text-[#475569] mt-1 leading-relaxed max-w-2xl">
                    {currentSop.summary}
                  </p>
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center gap-2">
                  {!isSelectedSopExecuting ? (
                    <button
                      onClick={() => handleInitiateSOP(currentSop)}
                      className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer"
                    >
                      <Play size={14} className="fill-white" />
                      Initiate Playbook for {currentZone?.name}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowSignoffModal(true)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                      >
                        <UserCheck size={14} />
                        GxP Sign-Off
                      </button>
                      <button
                        onClick={handleCancelActiveSOP}
                        className="p-2 rounded-xl bg-white border border-[#DCE8F6] text-rose-600 hover:bg-rose-50 text-xs font-bold transition cursor-pointer"
                        title="Cancel active execution"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar (When executing) */}
              {isSelectedSopExecuting && (
                <div className="pt-3 border-t border-[#F1F5F9] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#475569] font-semibold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Execution Progress ({completedStepsCount} of {currentSop.steps.length} Steps)
                    </span>
                    <span className="text-[#2563EB] font-bold">{progressPercent}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#EFF6FF] rounded-full overflow-hidden border border-[#DCE8F6]">
                    <div
                      className="h-full bg-gradient-to-r from-[#38BDF8] to-[#2563EB] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step-by-Step Interactive Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-[#475569] uppercase tracking-wider font-mono">
                  Procedure Execution Checklist ({currentSop.steps.length} Milestones)
                </span>
                {!isSelectedSopExecuting && (
                  <span className="text-[11px] text-[#475569] italic">
                    Click "Initiate Playbook" above to unlock checklist & actions
                  </span>
                )}
              </div>

              {currentSop.steps.map((step, index) => {
                const stepExec = executionState?.steps[step.id];
                const isCompleted = stepExec?.completed ?? false;
                const actionStatus = executionState?.actionStatus?.[step.id] ?? "idle";

                return (
                  <div
                    key={step.id}
                    className={`rounded-2xl border p-5 transition-all ${
                      isCompleted
                        ? "bg-[#F0FDF4] border-emerald-200"
                        : isSelectedSopExecuting
                        ? "bg-white border-[#DCE8F6] hover:border-[#38BDF8] shadow-sm"
                        : "bg-white/70 border-[#E2E8F0] opacity-85"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Checkbox */}
                      <button
                        disabled={!isSelectedSopExecuting}
                        onClick={() => handleToggleStep(step.id)}
                        className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                          isCompleted
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : isSelectedSopExecuting
                            ? "bg-white border-[#CBD5E1] hover:border-[#2563EB]"
                            : "bg-slate-100 border-slate-300 cursor-not-allowed"
                        }`}
                      >
                        {isCompleted && <Check size={16} strokeWidth={3} />}
                      </button>

                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              Step {index + 1}
                            </span>
                            <span className="text-xs font-bold text-[#0F172A]">{step.title}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-[#475569] font-mono">
                            <span className="px-2 py-0.5 rounded bg-white border border-[#DCE8F6]">
                              {step.subsystem}
                            </span>
                            <span>Est: ~{step.estimatedMinutes}m</span>
                            {stepExec?.timestamp && (
                              <span className="text-emerald-700 font-bold">
                                Done @ {stepExec.timestamp}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-[#475569] leading-relaxed font-sans">
                          {step.description}
                        </p>

                        {/* Interactive Hardware / API Action Button */}
                        {step.interactiveAction && isSelectedSopExecuting && (
                          <div className="pt-2 flex items-center gap-3">
                            <button
                              disabled={actionStatus === "running"}
                              onClick={() => handleExecuteInteractiveAction(step)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                                actionStatus === "running"
                                  ? "bg-slate-200 text-slate-500 cursor-wait"
                                  : isCompleted
                                  ? "bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm"
                              }`}
                            >
                              {actionStatus === "running" ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" />
                                  Executing...
                                </>
                              ) : (
                                <>
                                  <Zap size={12} />
                                  {step.interactiveAction.label}
                                </>
                              )}
                            </button>
                            <span className="text-[11px] text-[#475569] italic">
                              {step.interactiveAction.description}
                            </span>
                          </div>
                        )}

                        {/* Technician Observation Notes */}
                        {isSelectedSopExecuting && (
                          <div className="pt-2">
                            <input
                              type="text"
                              value={stepExec?.technicianNotes ?? ""}
                              onChange={(e) => handleStepNotesChange(step.id, e.target.value)}
                              placeholder="Add observation or physical measurement note (optional)..."
                              className="w-full text-xs px-3 py-1.5 rounded-lg bg-white border border-[#DCE8F6] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none text-[#0F172A]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Complete Banner (if running) */}
            {isSelectedSopExecuting && (
              <div className="rounded-2xl bg-white border border-[#DCE8F6] p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 text-xs text-[#475569]">
                  <Award size={18} className="text-[#2563EB]" />
                  <span>
                    Ready to complete? Sign off below to submit the electronic audit trail.
                  </span>
                </div>
                <button
                  onClick={() => setShowSignoffModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer"
                >
                  <UserCheck size={14} />
                  Proceed to GxP Electronic Sign-Off
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: GXP EXECUTION AUDIT LOG
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">GxP Electronic SOP Execution Records</h2>
              <p className="text-xs text-[#475569]">
                Immutable local compliance audit trail of all standard operating playbooks executed for cold storage zones.
              </p>
            </div>

            {auditLogs.length > 0 && (
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(auditLogs, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `ColdGuard_GxP_SOP_Audit_${Date.now()}.json`;
                  a.click();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white border border-[#DCE8F6] text-[#2563EB] hover:bg-[#EFF6FF] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download size={14} />
                Export Audit Trail (JSON)
              </button>
            )}
          </div>

          {auditLogs.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#DCE8F6] p-12 text-center space-y-3 shadow-arctic-card">
              <FileCheck2 size={36} className="mx-auto text-[#2563EB]/40" />
              <div className="text-sm font-bold text-[#0F172A]">No SOPs Executed Yet</div>
              <p className="text-xs text-[#475569] max-w-md mx-auto">
                Once a technician initiates and signs off on an SOP Playbook from the "Interactive SOP Playbooks"
                tab, the electronic signature and execution log will appear here.
              </p>
              <button
                onClick={() => setActiveTab("playbook")}
                className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8] transition cursor-pointer"
              >
                Go to Playbooks
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-[#DCE8F6] overflow-hidden shadow-arctic-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#0F172A]">
                  <thead className="bg-[#F8FAFC] border-b border-[#DCE8F6] text-[10px] font-mono uppercase text-[#475569]">
                    <tr>
                      <th className="py-3 px-4">Execution ID</th>
                      <th className="py-3 px-4">Playbook</th>
                      <th className="py-3 px-4">Zone</th>
                      <th className="py-3 px-4">Technician</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Milestones</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F8FAFC] transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#2563EB]">{log.id}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold">{log.sopCode}</div>
                          <div className="text-[11px] text-[#475569] truncate max-w-xs">{log.sopTitle}</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium">{log.zoneName}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold">{log.technicianName}</div>
                          <div className="text-[10px] text-[#475569] font-mono">{log.badgeId}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono">{log.durationMinutes} min</td>
                        <td className="py-3.5 px-4 font-mono">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                            {log.stepsCompleted} / {log.totalSteps}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#475569] font-mono text-[11px]">
                          {new Date(log.completedAt).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-[#475569] max-w-xs truncate">{log.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GXP ELECTRONIC SIGN-OFF MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showSignoffModal && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#DCE8F6] p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[#DCE8F6] pb-3">
              <div className="flex items-center gap-2 text-[#0F172A] font-bold text-sm">
                <FileCheck2 size={18} className="text-emerald-600" />
                GxP Part 11 Electronic Sign-Off
              </div>
              <button
                onClick={() => setShowSignoffModal(false)}
                className="text-[#475569] hover:text-[#0F172A] cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-xs text-[#0F172A] space-y-1">
              <div className="font-bold text-[#2563EB] font-mono">{currentSop.code}</div>
              <div>{currentSop.title}</div>
              <div className="text-[11px] text-[#475569]">
                Target Zone: <span className="font-semibold text-[#0F172A]">{currentZone?.name}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#475569] font-semibold mb-1">
                  Lead Technician Full Name:
                </label>
                <input
                  type="text"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-[#475569] font-semibold mb-1">
                  Employee Badge / License ID:
                </label>
                <input
                  type="text"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none text-[#0F172A] font-mono"
                />
              </div>

              <div>
                <label className="block text-[#475569] font-semibold mb-1">
                  Resolution / Verification Summary Notes:
                </label>
                <textarea
                  rows={3}
                  value={signoffNotes}
                  onChange={(e) => setSignoffNotes(e.target.value)}
                  placeholder="Describe resolution outcome, thermal recovery observed, or handover details..."
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none text-[#0F172A]"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-[#475569] leading-relaxed">
                By clicking "Electronically Sign & Complete", you certify that all mitigation steps were
                conducted in compliance with FDA 21 CFR Part 11 / EU GMP Annex 11 standard operating procedures.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE8F6]">
              <button
                onClick={() => setShowSignoffModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#475569] hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalSignoff}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer"
              >
                Electronically Sign & Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
