import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Battery,
  Bell,
  Boxes,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Cloud,
  Compass,
  Cpu,
  DoorClosed,
  DoorOpen,
  Droplets,
  ExternalLink,
  Eye,
  EyeOff,
  Fan,
  Filter,
  Flame,
  Footprints,
  Gauge,
  Grid,
  History,
  Home,
  Info,
  Layers,
  Lightbulb,
  LineChart as LineChartIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  Navigation,
  Play,
  Plus,
  Power,
  PowerOff,
  Radio,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Sun,
  Tag,
  Terminal,
  Thermometer,
  ThermometerSnowflake,
  ToggleLeft,
  ToggleRight,
  TrendingDown,
  TrendingUp,
  Truck,
  Warehouse,
  Waves,
  Wifi,
  Wind,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge, Card, EmptyState, LoadingState, StaleBanner } from "../components/ui";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { CHART, fmtNum, fmtTemp, POLL_MS } from "../lib/format";
import { api } from "../services/api";
import type {
  Alert,
  DoorEventItem,
  EventItem,
  ModelEvaluationResponse,
  RecoveryStatus,
  WhatIfRequest,
  WhatIfResponse,
  WhatIfScenarioId,
  ZoneSummary,
} from "../types/api";

// Three.js & React Three Fiber imports
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════
   TYPES & CONFIGURATIONS
   ═══════════════════════════════════════════════════════════════════ */

export type CameraPreset =
  | "isometric"
  | "top"
  | "side-right"
  | "side-left"
  | "front"
  | "aisle-walk"
  | "zone-a"
  | "zone-b"
  | "zone-c";

export type ViewDisplayMode = "standard" | "thermal" | "airflow" | "blueprint";

export type SimulationScenario = "normal" | "door_open" | "compressor_failure" | "sensor_burn" | "cooling_degradation";

interface SensorEvent {
  time: string;
  message: string;
  type: "info" | "warning" | "critical";
  zone: string;
}

interface SensorMetadata {
  id: string;
  model: string;
  location: string;
  type: string;
  calibrationDate: string;
}

interface ZoneConfig {
  id: string;
  name: string;
  product: string;
  image: string;
  description: string;
  tempRange: string;
  targetTemp: number;
  lowerLimit: number;
  upperLimit: number;
  color: string;
  glowColor: string;
  position: [number, number, number];
  size: [number, number, number];
  sensorPositions: [number, number, number][];
  sensors: SensorMetadata[];
}

const ZONE_CONFIGS: ZoneConfig[] = [
  {
    id: "zone-a",
    name: "Zone A",
    product: "Vaccines & Biologics",
    image: "/zones/zone-a.jpg",
    description:
      "High-density pharmaceutical cold room storing sensitive vaccines, insulin, and biologics on industrial steel racks. Equipped with dual-redundant PT100 RTD sensor nodes.",
    tempRange: "+2.0°C to +8.0°C",
    targetTemp: 5.0,
    lowerLimit: 2.0,
    upperLimit: 8.0,
    color: "#22D3EE",
    glowColor: "#06B6D4",
    position: [-6, 0, -2],
    size: [5.2, 3.5, 6.2],
    sensorPositions: [
      [-7.5, 1.8, -3.8],
      [-4.5, 1.8, -0.6],
    ],
    sensors: [
      {
        id: "TS-A1",
        model: "Sensirion SHT45-PT100 Pro",
        location: "Rack Tier 2 • North Upright",
        type: "Precision RTD & Humidity",
        calibrationDate: "12-Oct-2026",
      },
      {
        id: "TS-A2",
        model: "Sensirion SHT45-PT100 Pro",
        location: "Rack Tier 3 • South Upright (Redundant)",
        type: "Precision RTD & Airflow",
        calibrationDate: "12-Oct-2026",
      },
    ],
  },
  {
    id: "zone-b",
    name: "Zone B",
    product: "Dairy & Fresh Produce",
    image: "/zones/zone-b.jpg",
    description:
      "Commercial dairy and perishable produce chiller room storing milk, cheese crates, and fresh produce. Monitored for high-humidity mold prevention and shelf-life compliance.",
    tempRange: "0.0°C to +6.0°C",
    targetTemp: 3.0,
    lowerLimit: 0.0,
    upperLimit: 6.0,
    color: "#10B981",
    glowColor: "#059669",
    position: [0, 0, -2],
    size: [5.2, 3.5, 6.2],
    sensorPositions: [
      [-1.5, 1.8, -3.8],
      [1.5, 1.8, -0.6],
    ],
    sensors: [
      {
        id: "TS-B1",
        model: "Sensirion SHT45-PT100 Pro",
        location: "Aisle 2 • Produce Stacking Stanchion",
        type: "Industrial Thermistor & RH",
        calibrationDate: "14-Oct-2026",
      },
      {
        id: "TS-B2",
        model: "Sensirion SHT45-PT100 Pro",
        location: "Aisle 3 • Dairy Chiller Stanchion",
        type: "Industrial Thermistor & Airflow",
        calibrationDate: "14-Oct-2026",
      },
    ],
  },
  {
    id: "zone-c",
    name: "Zone C",
    product: "Frozen Goods & Loading Bay",
    image: "/zones/zone-c.jpg",
    description:
      "Deep freezer storage and active loading dock airlock with rapid-roll insulated sliding door. Highly susceptible to warm air ingress and temperature spikes during door operations.",
    tempRange: "-25.0°C to -15.0°C",
    targetTemp: -20.0,
    lowerLimit: -25.0,
    upperLimit: -15.0,
    color: "#3B82F6",
    glowColor: "#2563EB",
    position: [6, 0, -2],
    size: [5.2, 3.5, 6.2],
    sensorPositions: [
      [4.5, 1.8, -3.8],
      [7.5, 1.8, -0.6],
    ],
    sensors: [
      {
        id: "TS-C1",
        model: "Sensirion Cryo-Ultra SHT40",
        location: "Loading Dock Airlock • Portal Wall",
        type: "Cryogenic Sub-Zero RTD",
        calibrationDate: "10-Oct-2026",
      },
      {
        id: "TS-C2",
        model: "Sensirion Cryo-Ultra SHT40",
        location: "Deep Freeze Pallet Row • Rear Wall",
        type: "Cryogenic Sub-Zero RTD",
        calibrationDate: "10-Oct-2026",
      },
    ],
  },
];

/* Google Maps / Earth Camera Flight Coordinates */
const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  isometric: { pos: [11, 12, 13], target: [0, 1.2, -2] },
  top: { pos: [0, 21, -2.01], target: [0, 0, -2] },
  "side-right": { pos: [19, 3.2, -2], target: [0, 1.6, -2] },
  "side-left": { pos: [-19, 3.2, -2], target: [0, 1.6, -2] },
  front: { pos: [0, 4.2, 14], target: [0, 1.5, -2] },
  "aisle-walk": { pos: [0, 1.6, 2.2], target: [0, 1.6, -2.0] },
  // Google Maps Fly-To Close-Up Coordinates (Intimate framing inside each zone)
  "zone-a": { pos: [-6, 2.0, 2.4], target: [-6, 1.4, -2.0] },
  "zone-b": { pos: [0, 2.0, 2.4], target: [0, 1.4, -2.0] },
  "zone-c": { pos: [6, 2.0, 2.4], target: [6, 1.4, -2.0] },
};

/* ═══════════════════════════════════════════════════════════════════
   GOOGLE MAPS 3D CAMERA RIG & CONTROLLER
   ═══════════════════════════════════════════════════════════════════ */

function CameraRig({
  preset,
  autoRotate,
  userInteracting,
  setUserInteracting,
  onHeadingChange,
  onNavigationProgress,
  controlsRef,
}: {
  preset: CameraPreset;
  autoRotate: boolean;
  userInteracting: boolean;
  setUserInteracting: (v: boolean) => void;
  onHeadingChange?: (heading: number) => void;
  onNavigationProgress?: (distanceMeters: number, isArrived: boolean) => void;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const targetConfig = CAMERA_PRESETS[preset] ?? CAMERA_PRESETS.isometric;

  const desiredPos = useMemo(() => new THREE.Vector3(...targetConfig.pos), [targetConfig]);
  const desiredTarget = useMemo(() => new THREE.Vector3(...targetConfig.target), [targetConfig]);

  const isTransitioningRef = useRef(true);
  const lastPresetRef = useRef(preset);

  useEffect(() => {
    lastPresetRef.current = preset;
    isTransitioningRef.current = true;
  }, [preset]);

  useFrame(() => {
    if (!controlsRef.current) return;

    // Smooth Google Maps flight interpolation
    if (isTransitioningRef.current && !userInteracting) {
      camera.position.lerp(desiredPos, 0.055);
      controlsRef.current.target.lerp(desiredTarget, 0.055);
      controlsRef.current.update();

      const dist = camera.position.distanceTo(desiredPos);
      const targetDist = controlsRef.current.target.distanceTo(desiredTarget);

      if (onNavigationProgress) {
        onNavigationProgress(dist * 2.2, dist < 0.15);
      }

      if (dist < 0.1 && targetDist < 0.1) {
        isTransitioningRef.current = false;
        if (onNavigationProgress) {
          onNavigationProgress(0, true);
        }
      }
    }

    // Report compass bearing
    if (onHeadingChange && controlsRef.current) {
      const angle = Math.atan2(
        camera.position.x - controlsRef.current.target.x,
        camera.position.z - controlsRef.current.target.z
      );
      onHeadingChange((angle * 180) / Math.PI);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      autoRotate={autoRotate}
      autoRotateSpeed={0.8}
      minPolarAngle={0.01}
      maxPolarAngle={Math.PI / 2 - 0.03}
      minDistance={1.2}
      maxDistance={35}
      dampingFactor={0.08}
      enableDamping
      onStart={() => {
        setUserInteracting(true);
        isTransitioningRef.current = false;
      }}
      onEnd={() => {
        setUserInteracting(false);
      }}
    />
  );
}


/* ═══════════════════════════════════════════════════════════════════
   📍 GOOGLE MAPS 3D LOCATION PIN & WALKING ROUTE
   ═══════════════════════════════════════════════════════════════════ */

function MapLocationPin({
  position,
  zoneName,
  color,
}: {
  position: [number, number, number];
  zoneName: string;
  color: string;
}) {
  const pinRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (pinRef.current) {
      pinRef.current.position.y = 3.6 + Math.sin(t * 3.5) * 0.12;
    }
    if (ringRef.current) {
      const s = 1 + (t % 1.5) * 0.6;
      ringRef.current.scale.set(s, s, s);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.6 - (t % 1.5) * 0.4);
    }
  });

  return (
    <group position={[position[0], 0, position[2]]}>
      {/* Ground pulsing location ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.5, 0.68, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Vertical light beam pointing down */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.02, 0.05, 3.6, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      {/* Floating Google Maps Pin Marker */}
      <group ref={pinRef} position={[0, 3.6, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.28, 24, 24]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            metalness={0.4}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, -0.22, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.22, 0.42, 24]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            metalness={0.4}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0, 0.22]}>
          <circleGeometry args={[0.1, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        <Html position={[0, 0.55, 0]} center distanceFactor={9} zIndexRange={[300, 0]}>
          <div className="pointer-events-none select-none flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/95 border border-white/20 text-white font-mono text-[11px] font-bold shadow-2xl backdrop-blur-md whitespace-nowrap">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span>📍 {zoneName}</span>
          </div>
        </Html>
      </group>
    </group>
  );
}

/** Illuminated Navigation Walking Route on Warehouse Floor with Animated GPS Puck */
function NavigationRoute({
  targetZoneId,
  isNavigating,
}: {
  targetZoneId: string | null;
  isNavigating?: boolean;
}) {
  if (!targetZoneId) return null;
  const cfg = ZONE_CONFIGS.find((c) => c.id === targetZoneId);
  if (!cfg) return null;

  const targetX = cfg.position[0];
  const dockX = 9.5;
  const aisleZ = 2.4;
  const rackZ = -2.0;

  const arrowPuckRef = useRef<THREE.Group>(null);
  const chevronsRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (arrowPuckRef.current) {
      // Dynamic GPS arrow travels down the aisle toward the target zone
      const cycle = (t * 0.45) % 1.0;
      if (cycle < 0.6) {
        const p = cycle / 0.6;
        arrowPuckRef.current.position.x = dockX + (targetX - dockX) * p;
        arrowPuckRef.current.position.z = aisleZ;
        arrowPuckRef.current.rotation.y = targetX < dockX ? Math.PI : 0;
      } else {
        const p = (cycle - 0.6) / 0.4;
        arrowPuckRef.current.position.x = targetX;
        arrowPuckRef.current.position.z = aisleZ + (rackZ - aisleZ) * p;
        arrowPuckRef.current.rotation.y = -Math.PI / 2;
      }
    }

    if (chevronsRef.current) {
      chevronsRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        if (mesh && mesh.material) {
          const mat = mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.3 + Math.sin(t * 4 + i * 0.8) * 0.35;
        }
      });
    }
  });

  return (
    <group position={[0, 0.035, 0]}>
      {/* Walkway corridor line */}
      <mesh
        position={[(dockX + targetX) / 2, 0, aisleZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[Math.abs(dockX - targetX), 0.35]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.65} />
      </mesh>

      {/* Corridor glowing border rails */}
      {[-0.18, 0.18].map((offsetZ, idx) => (
        <mesh
          key={`rail-h-${idx}`}
          position={[(dockX + targetX) / 2, 0.005, aisleZ + offsetZ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[Math.abs(dockX - targetX), 0.04]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} />
        </mesh>
      ))}

      {/* Aisle Turn line into zone */}
      <mesh
        position={[targetX, 0, (aisleZ + rackZ) / 2]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
      >
        <planeGeometry args={[Math.abs(aisleZ - rackZ), 0.35]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.65} />
      </mesh>

      {/* Aisle glowing border rails */}
      {[-0.18, 0.18].map((offsetX, idx) => (
        <mesh
          key={`rail-v-${idx}`}
          position={[targetX + offsetX, 0.005, (aisleZ + rackZ) / 2]}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        >
          <planeGeometry args={[Math.abs(aisleZ - rackZ), 0.04]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} />
        </mesh>
      ))}

      {/* Pulsing Chevrons group */}
      <group ref={chevronsRef}>
        {[-4, -2.5, -1, 0.5, 2, 3.5].map((off, idx) => {
          const posX = (dockX + targetX) / 2 + off;
          if (posX > Math.min(dockX, targetX) && posX < Math.max(dockX, targetX)) {
            return (
              <mesh
                key={`chv-${idx}`}
                position={[posX, 0.01, aisleZ]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[0.26, 0.14]} />
                <meshBasicMaterial color="#67e8f9" transparent opacity={0.6} />
              </mesh>
            );
          }
          return null;
        })}
      </group>

      {/* 🚀 Iconic Google Maps Blue GPS Navigation Puck */}
      <group ref={arrowPuckRef} position={[dockX, 0.05, aisleZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.28, 0.42, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.24, 24]} />
          <meshBasicMaterial color="#0284c7" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, -Math.PI / 2]} position={[0, 0.01, 0]}>
          <coneGeometry args={[0.14, 0.28, 3]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ARCHITECTURAL & STRUCTURAL 3D COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function WarehouseFloor() {
  return (
    <group position={[0, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[32, 22]} />
        <meshStandardMaterial color="#08101c" roughness={0.3} metalness={0.2} />
      </mesh>

      <lineSegments position={[0, 0.01, -2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(20.4, 0.01, 7.6)]} />
        <lineBasicMaterial color="#334155" transparent opacity={0.6} />
      </lineSegments>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 2.4]}>
        <planeGeometry args={[20, 1.2]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.7} />
      </mesh>

      {[-9, -6, -3, 0, 3, 6, 9].map((x) => (
        <mesh key={`walkway-${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, 2.4]}>
          <planeGeometry args={[0.3, 1.1]} />
          <meshBasicMaterial color="#eab308" transparent opacity={0.25} />
        </mesh>
      ))}

      <gridHelper args={[32, 32, "#1e293b", "#091322"]} position={[0, 0.01, 0]} />
    </group>
  );
}

function BuildingShell({ viewMode }: { viewMode: ViewDisplayMode }) {
  const wallOpacity = viewMode === "blueprint" ? 0.15 : 0.4;

  return (
    <group>
      <mesh position={[0, 1.75, -5.6]} receiveShadow>
        <boxGeometry args={[20.4, 3.5, 0.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} transparent opacity={wallOpacity} />
      </mesh>

      <mesh position={[-10.2, 1.75, -2]} receiveShadow>
        <boxGeometry args={[0.2, 3.5, 7.4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} transparent opacity={wallOpacity} />
      </mesh>

      <mesh position={[10.2, 1.75, -3.8]} receiveShadow>
        <boxGeometry args={[0.2, 3.5, 3.8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} transparent opacity={wallOpacity} />
      </mesh>

      {[-3, 3].map((x, i) => (
        <group key={`divider-${i}`} position={[x, 1.75, -2]}>
          <mesh>
            <boxGeometry args={[0.15, 3.5, 6.8]} />
            <meshStandardMaterial color="#0f172a" transparent opacity={0.3} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 3.4]}>
            <boxGeometry args={[0.25, 3.5, 0.25]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {[-9, -6, -3, 0, 3, 6, 9].map((x, i) => (
        <group key={`truss-${i}`} position={[x, 3.5, -2]}>
          <mesh>
            <boxGeometry args={[0.12, 0.16, 7.2]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}

      <group position={[0, 3.35, -4]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 19.5, 16]} />
          <meshStandardMaterial color="#06b6d4" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.12, 0.1]}>
          <cylinderGeometry args={[0.04, 0.04, 19.5, 16]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.5} />
        </mesh>
      </group>

      {[-6, 0, 6].map((x, i) => (
        <group key={`bay-light-${i}`} position={[x, 3.3, -2]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.2, 0.1, 16]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.02, 16]} />
            <meshBasicMaterial color="#e0f2fe" />
          </mesh>
          <spotLight
            position={[0, -0.1, 0]}
            target-position={[x, 0, -2]}
            color="#bae6fd"
            intensity={0.4}
            angle={0.7}
            penumbra={0.6}
            distance={7}
          />
        </group>
      ))}
    </group>
  );
}

function ArchitecturalGuides({
  cameraPreset,
  viewMode,
}: {
  cameraPreset: CameraPreset;
  viewMode: ViewDisplayMode;
}) {
  const showGuides =
    viewMode === "blueprint" ||
    cameraPreset === "top" ||
    cameraPreset === "side-right" ||
    cameraPreset === "side-left";

  if (!showGuides) return null;

  return (
    <group>
      {(cameraPreset === "top" || viewMode === "blueprint") && (
        <>
          <group position={[0, 0.1, 2.8]}>
            <lineSegments>
              <bufferGeometry
                attach="geometry"
                onUpdate={(self) => {
                  self.setFromPoints([new THREE.Vector3(-10, 0, 0), new THREE.Vector3(10, 0, 0)]);
                }}
              />
              <lineBasicMaterial attach="material" color="#22D3EE" opacity={0.7} transparent />
            </lineSegments>
            <Html position={[0, 0.1, 0]} center distanceFactor={14}>
              <span className="bg-slate-950/90 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded text-[9px] font-mono shadow-md">
                Facility Width: 20.0 m
              </span>
            </Html>
          </group>

          <group position={[-11, 0.1, -2]}>
            <lineSegments>
              <bufferGeometry
                attach="geometry"
                onUpdate={(self) => {
                  self.setFromPoints([new THREE.Vector3(0, 0, -3.1), new THREE.Vector3(0, 0, 3.1)]);
                }}
              />
              <lineBasicMaterial attach="material" color="#22D3EE" opacity={0.7} transparent />
            </lineSegments>
            <Html position={[-0.3, 0.1, 0]} center distanceFactor={14}>
              <span className="bg-slate-950/90 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded text-[9px] font-mono shadow-md whitespace-nowrap">
                Depth: 6.2 m
              </span>
            </Html>
          </group>
        </>
      )}

      {(cameraPreset === "side-right" || cameraPreset === "side-left" || viewMode === "blueprint") && (
        <group position={[0, 0, 2]}>
          <lineSegments>
            <bufferGeometry
              attach="geometry"
              onUpdate={(self) => {
                self.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3.5, 0)]);
              }}
            />
            <lineBasicMaterial attach="material" color="#F59E0B" opacity={0.8} transparent />
          </lineSegments>
          <Html position={[0, 1.75, 0]} center distanceFactor={12}>
            <span className="bg-slate-950/90 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[9px] font-mono shadow-md whitespace-nowrap">
              Ceiling: 3.5 m
            </span>
          </Html>
        </group>
      )}
    </group>
  );
}

function ZoneFloor({
  config,
  status,
  selected,
  temp,
  viewMode,
  onClick,
}: {
  config: ZoneConfig;
  status: "normal" | "warning" | "critical";
  selected: boolean;
  temp: number;
  viewMode: ViewDisplayMode;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const borderRef = useRef<THREE.Mesh>(null);

  const floorColor = useMemo(() => {
    if (viewMode === "thermal") {
      if (temp < -15) return "#3B82F6";
      if (temp < 0) return "#06B6D4";
      if (temp <= 5) return "#10B981";
      if (temp <= 7) return "#F59E0B";
      return "#EF4444";
    }
    return status === "critical" ? "#F43F5E" : status === "warning" ? "#F59E0B" : config.color;
  }, [viewMode, temp, status, config.color]);

  useFrame(({ clock }) => {
    if (borderRef.current) {
      const mat = borderRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + Math.sin(clock.getElapsedTime() * 2) * 0.12;
    }
  });

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh
        ref={meshRef}
        position={[config.position[0], 0.02, config.position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[config.size[0] - 0.2, config.size[2] - 0.2]} />
        <meshStandardMaterial
          color={floorColor}
          transparent
          opacity={viewMode === "thermal" ? 0.35 : selected ? 0.32 : 0.16}
          emissive={floorColor}
          emissiveIntensity={selected ? 0.7 : 0.2}
          roughness={0.3}
        />
      </mesh>

      <mesh
        ref={borderRef}
        position={[config.position[0], 0.025, config.position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry
          args={[
            Math.min(config.size[0], config.size[2]) * 0.44,
            Math.min(config.size[0], config.size[2]) * 0.47,
            4,
          ]}
        />
        <meshBasicMaterial color={floorColor} transparent opacity={selected ? 0.7 : 0.3} side={THREE.DoubleSide} />
      </mesh>

      <lineSegments position={[config.position[0], 0.03, config.position[2]]}>
        <edgesGeometry args={[new THREE.BoxGeometry(config.size[0] - 0.1, 0.01, config.size[2] - 0.1)]} />
        <lineBasicMaterial color={selected ? "#FFFFFF" : floorColor} transparent opacity={selected ? 0.95 : 0.4} />
      </lineSegments>

    </group>
  );
}

function StorageRacks({
  config,
  hasAccident,
  onSelectZone,
}: {
  config: ZoneConfig;
  hasAccident: boolean;
  onSelectZone: () => void;
}) {
  const rackUprightBlue = "#1e40af";
  const rackBeamOrange = "#ea580c";
  const palletWood = "#854d0e";
  const rows = [-1.3, 1.3];

  return (
    <group
      position={[config.position[0], 0, config.position[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onSelectZone();
      }}
    >
      {rows.map((rowX, rIdx) => {
        const isDisrupted = hasAccident && rIdx === 1;

        return (
          <group
            key={`rack-row-${rIdx}`}
            position={[rowX, 0, 0]}
            rotation={[isDisrupted ? 0.08 : 0, 0, isDisrupted ? 0.06 : 0]}
          >
            {[-1.8, 1.8].map((zPos, zIdx) =>
              [-0.45, 0.45].map((xOffset, xIdx) => (
                <mesh key={`upright-${zIdx}-${xIdx}`} position={[xOffset, 1.3, zPos]} castShadow>
                  <boxGeometry args={[0.06, 2.6, 0.06]} />
                  <meshStandardMaterial color={rackUprightBlue} metalness={0.7} roughness={0.3} />
                </mesh>
              ))
            )}

            {[-1.8, 1.8].map((zPos, zIdx) => (
              <mesh key={`bollard-${zIdx}`} position={[rowX > 0 ? 0.6 : -0.6, 0.25, zPos]}>
                <cylinderGeometry args={[0.07, 0.07, 0.5, 12]} />
                <meshStandardMaterial color="#eab308" roughness={0.4} />
              </mesh>
            ))}

            {[0.5, 1.3, 2.1].map((tierY, tierIdx) => (
              <group key={`tier-${tierIdx}`} position={[0, tierY, 0]}>
                {[-0.45, 0.45].map((xOffset, xIdx) => (
                  <mesh key={`beam-${xIdx}`} position={[xOffset, 0, 0]} castShadow>
                    <boxGeometry args={[0.04, 0.08, 3.6]} />
                    <meshStandardMaterial color={rackBeamOrange} metalness={0.5} roughness={0.4} />
                  </mesh>
                ))}

                <mesh position={[0, -0.02, 0]}>
                  <boxGeometry args={[0.88, 0.02, 3.55]} />
                  <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
                </mesh>

                {[-0.9, 0.9].map((palZ, palIdx) => (
                  <group key={`pallet-${tierIdx}-${palIdx}`} position={[0, 0.05, palZ]}>
                    <mesh castShadow>
                      <boxGeometry args={[0.8, 0.08, 1.2]} />
                      <meshStandardMaterial color={palletWood} roughness={0.9} />
                    </mesh>

                    {config.id === "zone-a" ? (
                      <group position={[0, 0.22, 0]}>
                        {[-0.18, 0.18].map((bx, bxi) =>
                          [-0.3, 0.3].map((bz, bzi) => (
                            <group key={`vac-${bxi}-${bzi}`} position={[bx, 0, bz]}>
                              <mesh castShadow>
                                <boxGeometry args={[0.32, 0.35, 0.5]} />
                                <meshStandardMaterial color="#f8fafc" roughness={0.5} />
                              </mesh>
                              <mesh position={[0, 0.18, 0]}>
                                <boxGeometry args={[0.33, 0.04, 0.51]} />
                                <meshStandardMaterial color="#0284c7" roughness={0.4} />
                              </mesh>
                            </group>
                          ))
                        )}
                      </group>
                    ) : config.id === "zone-b" ? (
                      <group position={[0, 0.22, 0]}>
                        {[-0.18, 0.18].map((bx, bxi) =>
                          [-0.3, 0.3].map((bz, bzi) => (
                            <mesh key={`crate-${bxi}-${bzi}`} position={[bx, 0, bz]} castShadow>
                              <boxGeometry args={[0.34, 0.32, 0.52]} />
                              <meshStandardMaterial color={bxi === 0 ? "#15803d" : "#c2410c"} roughness={0.7} />
                            </mesh>
                          ))
                        )}
                      </group>
                    ) : (
                      <group position={[0, 0.3, 0]}>
                        <mesh castShadow>
                          <boxGeometry args={[0.75, 0.52, 1.1]} />
                          <meshStandardMaterial color="#b45309" roughness={0.9} />
                        </mesh>
                        <mesh>
                          <boxGeometry args={[0.77, 0.54, 1.12]} />
                          <meshStandardMaterial color="#94a3b8" transparent opacity={0.2} roughness={0.1} />
                        </mesh>
                      </group>
                    )}
                  </group>
                ))}
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INCIDENT & VISUAL EFFECTS
   ═══════════════════════════════════════════════════════════════════ */

function FireSmokeParticles({ position }: { position: [number, number, number] }) {
  const fireRef = useRef<THREE.Points>(null);
  const smokeRef = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const fireCount = 75;
  const fireGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(fireCount * 3);
    const col = new Float32Array(fireCount * 3);
    for (let i = 0; i < fireCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 1] = Math.random() * 0.8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      col[i * 3] = 1.0;
      col[i * 3 + 1] = Math.random() * 0.6;
      col[i * 3 + 2] = 0.0;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  }, []);

  const smokeCount = 50;
  const smokeGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(smokeCount * 3);
    for (let i = 0; i < smokeCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.6;
      pos[i * 3 + 1] = 0.6 + Math.random() * 1.6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (fireRef.current) {
      const positions = fireRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < fireCount; i++) {
        positions[i * 3 + 1] += 0.02 + Math.random() * 0.015;
        positions[i * 3] += Math.sin(t * 10 + i) * 0.005;
        if (positions[i * 3 + 1] > 1.0) {
          positions[i * 3 + 1] = 0;
          positions[i * 3] = (Math.random() - 0.5) * 0.3;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        }
      }
      fireRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (smokeRef.current) {
      const pos = smokeRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < smokeCount; i++) {
        pos[i * 3 + 1] += 0.012;
        pos[i * 3] += Math.sin(t * 2 + i) * 0.003;
        if (pos[i * 3 + 1] > 2.2) {
          pos[i * 3 + 1] = 0.6;
          pos[i * 3] = (Math.random() - 0.5) * 0.4;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
        }
      }
      smokeRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (lightRef.current) {
      lightRef.current.intensity = 2.5 + Math.sin(t * 15) * 1.2 + (Math.random() - 0.5) * 0.6;
    }
  });

  return (
    <group position={position}>
      <pointLight ref={lightRef} color="#ff4500" distance={6} />
      <points ref={fireRef} geometry={fireGeo}>
        <pointsMaterial size={0.08} vertexColors transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      <points ref={smokeRef} geometry={smokeGeo}>
        <pointsMaterial size={0.12} color="#1e293b" transparent opacity={0.4} depthWrite={false} />
      </points>
      <mesh position={[0, -position[1] + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 16]} />
        <meshBasicMaterial color="#09090b" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function ElectricalSparks({ position }: { position: [number, number, number] }) {
  const sparkRef = useRef<THREE.Points>(null);
  const sparkCount = 30;

  const sparkGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  useFrame(() => {
    if (sparkRef.current) {
      const pos = sparkRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < sparkCount; i++) {
        pos[i * 3] += (Math.random() - 0.5) * 0.04;
        pos[i * 3 + 1] += (Math.random() - 0.5) * 0.04 - 0.01;
        pos[i * 3 + 2] += (Math.random() - 0.5) * 0.04;
        if (Math.abs(pos[i * 3]) > 0.4 || Math.abs(pos[i * 3 + 1]) > 0.4) {
          pos[i * 3] = (Math.random() - 0.5) * 0.1;
          pos[i * 3 + 1] = 0;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
        }
      }
      sparkRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      <points ref={sparkRef} geometry={sparkGeo}>
        <pointsMaterial size={0.05} color="#38bdf8" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      <pointLight color="#38bdf8" intensity={1.5} distance={3} />
    </group>
  );
}

function WarmAirIngress({ isOpen, isRecovering }: { isOpen: boolean; isRecovering?: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 140;

  const geo = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = 10.1 + (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 1] = 0.5 + Math.random() * 2.2;
      pos[i * 3 + 2] = -1.8 + (Math.random() - 0.5) * 1.4;
      col[i * 3] = 1.0;
      col[i * 3 + 1] = 0.35 + Math.random() * 0.4;
      col[i * 3 + 2] = 0.05;
    }
    buffer.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    buffer.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return buffer;
  }, []);

  useFrame(() => {
    if (pointsRef.current && (isOpen || isRecovering)) {
      const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
      const speed = isOpen ? 0.045 : 0.012;
      for (let i = 0; i < count; i++) {
        pos[i * 3] -= speed;
        pos[i * 3 + 1] += 0.004;
        pos[i * 3 + 2] += (Math.random() - 0.5) * 0.015;

        if (pos[i * 3] < 5.0) {
          pos[i * 3] = 10.1;
          pos[i * 3 + 1] = 0.5 + Math.random() * 2.0;
          pos[i * 3 + 2] = -1.8 + (Math.random() - 0.5) * 1.4;
        }
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (!isOpen && !isRecovering) return null;

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        size={isOpen ? 0.08 : 0.045}
        vertexColors
        transparent
        opacity={isOpen ? 0.8 : 0.35}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function AccidentScene({ zoneId }: { zoneId: string }) {
  const config = ZONE_CONFIGS.find((c) => c.id === zoneId);
  if (!config) return null;

  const beaconLightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (beaconLightRef.current) {
      const t = clock.getElapsedTime();
      beaconLightRef.current.intensity = 2.5 + Math.sin(t * 8) * 2;
    }
  });

  return (
    <group position={[config.position[0], 0, config.position[2]]}>
      <group position={[0, 3.4, 0]}>
        <mesh>
          <cylinderGeometry args={[0.15, 0.12, 0.2, 16]} />
          <meshStandardMaterial color="#dc2626" emissive="#ef4444" emissiveIntensity={1} />
        </mesh>
        <pointLight ref={beaconLightRef} color="#ef4444" distance={9} />
      </group>

      <group position={[0.2, 0.15, 0.8]} rotation={[0.2, 0.4, 0.35]}>
        <mesh castShadow>
          <boxGeometry args={[0.6, 0.3, 1.4]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.5, 0.6]} rotation={[-0.4, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </group>

      {[
        { x: -0.6, z: 0.5, rot: 0.6, col: "#ea580c" },
        { x: 0.8, z: 1.2, rot: -0.4, col: "#f8fafc" },
        { x: -0.2, z: 1.5, rot: 1.1, col: "#15803d" },
        { x: 0.5, z: 0.2, rot: -0.8, col: "#b45309" },
      ].map((box, i) => (
        <mesh key={`spilled-${i}`} position={[box.x, 0.12, box.z]} rotation={[0.3, box.rot, 0.5]} castShadow>
          <boxGeometry args={[0.35, 0.25, 0.35]} />
          <meshStandardMaterial color={box.col} roughness={0.7} />
        </mesh>
      ))}

      {[-1.6, 1.6].map((x, i) => (
        <group key={`tape-post-${i}`} position={[x, 0.45, 1.8]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.04, 0.9, 8]} />
            <meshStandardMaterial color="#eab308" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
      ))}

      <Html position={[0, 2.2, 0.8]} center distanceFactor={9}>
        <div className="bg-red-950/95 border-2 border-red-500 text-red-200 px-3 py-1.5 rounded-lg shadow-2xl backdrop-blur-md flex items-center gap-2 animate-pulse whitespace-nowrap">
          <AlertTriangle size={14} className="text-red-400" />
          <span className="font-mono font-bold text-xs uppercase tracking-wider">
            Critical Accident Zone • Forklift Impact
          </span>
        </div>
      </Html>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SENSOR NODE WITH CLOSE-UP INSPECTION TELEMETRY
   ═══════════════════════════════════════════════════════════════════ */

function SensorNode({
  position,
  sensorId,
  zoneId,
  zoneConfig,
  temperature,
  humidity,
  airflow,
  status,
  isFailed,
  isBurned,
  hasAccident,
  isZoneFocused,
  showLabel,
  showCoverage,
  onSelect,
}: {
  position: [number, number, number];
  sensorId: string;
  zoneId: string;
  zoneConfig: ZoneConfig;
  temperature: number;
  humidity: number;
  airflow: number;
  status: "normal" | "warning" | "critical";
  isFailed: boolean;
  isBurned: boolean;
  hasAccident: boolean;
  isZoneFocused: boolean;
  showLabel: boolean;
  showCoverage: boolean;
  onSelect: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  const statusColor = isBurned
    ? "#FF4500"
    : isFailed
    ? "#F43F5E"
    : hasAccident
    ? "#FF6B00"
    : status === "critical"
    ? "#F43F5E"
    : status === "warning"
    ? "#F59E0B"
    : "#22D3EE";

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.8;
      const pulse = 1 + Math.sin(t * 3) * 0.06;
      meshRef.current.scale.setScalar(pulse);
    }
    if (beaconRef.current) {
      const mat = beaconRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.2 + Math.sin(t * 4) * 0.2;
      beaconRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.15);
    }
  });

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      <mesh ref={meshRef} castShadow>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          color={isBurned ? "#18181b" : statusColor}
          emissive={isBurned ? "#ef4444" : statusColor}
          emissiveIntensity={isFailed || isBurned ? 1.5 : 0.6}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>

      <mesh ref={beaconRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <ringGeometry args={[0.26, 0.38, 32]} />
        <meshBasicMaterial color={statusColor} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, -0.9, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.8, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0, -1.8, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>

      {showCoverage && (
        <mesh>
          <sphereGeometry args={[2.2, 16, 16]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.06} wireframe />
        </mesh>
      )}

      {isBurned && <FireSmokeParticles position={[0, 0.1, 0]} />}
      {isFailed && !isBurned && <ElectricalSparks position={[0, 0.1, 0]} />}

      {showLabel && (
        <Html position={[0, 0.6, 0]} center distanceFactor={8} zIndexRange={[100, 0]}>
          <div
            className={`pointer-events-auto cursor-pointer select-none rounded-xl border p-2 font-mono backdrop-blur-md shadow-2xl transition-all whitespace-nowrap ${
              isBurned
                ? "bg-red-950/95 border-red-500 text-red-200 animate-pulse shadow-red-500/40"
                : isFailed
                ? "bg-rose-950/95 border-rose-500 text-rose-200 animate-pulse shadow-rose-500/40"
                : hasAccident
                ? "bg-orange-950/95 border-orange-500 text-orange-200 animate-pulse shadow-orange-500/40"
                : status === "critical"
                ? "bg-rose-950/90 border-rose-500/70 text-rose-100"
                : status === "warning"
                ? "bg-amber-950/90 border-amber-500/70 text-amber-100"
                : "bg-slate-900/90 border-cyan-500/50 text-cyan-100"
            } ${isZoneFocused ? "ring-2 ring-cyan-400/80 scale-105" : ""}`}
            onClick={onSelect}
          >
            <div className="flex items-center justify-between gap-3 mb-1 border-b border-white/10 pb-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    isBurned
                      ? "bg-red-500 animate-ping"
                      : isFailed
                      ? "bg-rose-500 animate-ping"
                      : hasAccident
                      ? "bg-orange-500 animate-pulse"
                      : status === "critical"
                      ? "bg-rose-400"
                      : status === "warning"
                      ? "bg-amber-400"
                      : "bg-cyan-400"
                  }`}
                />
                <span className="font-bold text-xs tracking-wide text-white">{sensorId}</span>
              </div>
              <span className="text-[8px] px-1.5 py-0.2 rounded bg-white/10 text-fg-muted font-bold">
                {zoneConfig.name}
              </span>
            </div>

            {isBurned ? (
              <div className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                <Flame size={12} /> HARDWARE THERMAL RUNAWAY
              </div>
            ) : isFailed ? (
              <div className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                <ZapOff size={12} /> TELEMETRY SIGNAL TIMEOUT
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[9px] text-fg-muted flex items-center gap-1">
                    <Thermometer size={10} className="text-cyan-400" /> Temp:
                  </span>
                  <span className="text-xs font-bold text-white">{fmtTemp(temperature)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[9px] text-fg-muted flex items-center gap-1">
                    <Droplets size={10} className="text-blue-400" /> Humidity:
                  </span>
                  <span className="text-[10px] font-bold text-blue-200">{humidity.toFixed(0)}% RH</span>
                </div>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EQUIPMENT & REFRIGERATION UNITS
   ═══════════════════════════════════════════════════════════════════ */

function Compressor({
  position,
  isRunning,
  isFailed,
}: {
  position: [number, number, number];
  isRunning: boolean;
  isFailed: boolean;
}) {
  const fanRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (fanRef.current && isRunning) {
      fanRef.current.rotation.z += delta * 12;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[1.8, 0.2, 1.2]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      {[-0.45, 0.45].map((x, i) => (
        <group key={`comp-cyl-${i}`} position={[x, 0.55, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.7, 24]} />
            <meshStandardMaterial
              color={isFailed ? "#991b1b" : isRunning ? "#0284c7" : "#475569"}
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.2, 0.12, 0.2]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 0.7, 0.65]}>
        <cylinderGeometry args={[0.35, 0.35, 0.1, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh ref={fanRef} position={[0, 0.7, 0.72]}>
        <torusGeometry args={[0.2, 0.04, 4, 4]} />
        <meshStandardMaterial color={isRunning ? "#38bdf8" : "#64748b"} metalness={0.6} />
      </mesh>

      <Html position={[0, 1.3, 0]} center distanceFactor={10}>
        <div
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-mono backdrop-blur-md shadow-lg whitespace-nowrap ${
            isFailed
              ? "bg-red-950/90 border-red-500 text-red-300 animate-pulse"
              : isRunning
              ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
              : "bg-slate-900/80 border-slate-600/40 text-slate-400"
          }`}
        >
          <Cpu size={10} />
          <span className="font-bold">Compressor:</span>
          <span className={`font-bold ${isFailed ? "text-red-400" : isRunning ? "text-emerald-400" : "text-amber-400"}`}>
            {isFailed ? "TRIPPED / OFFLINE" : isRunning ? "Running (78% Load)" : "Standby"}
          </span>
        </div>
      </Html>
    </group>
  );
}

function EvaporatorUnit({
  position,
  isRunning,
}: {
  position: [number, number, number];
  isRunning: boolean;
}) {
  const fan1Ref = useRef<THREE.Mesh>(null);
  const fan2Ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (isRunning) {
      if (fan1Ref.current) fan1Ref.current.rotation.z += delta * 15;
      if (fan2Ref.current) fan2Ref.current.rotation.z += delta * 15;
    }
  });

  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.8, 0.5, 0.9]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>

      {[-0.5, 0.5].map((fx, i) => (
        <group key={`evap-fan-${i}`} position={[fx, -0.26, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.05, 24]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh
            ref={i === 0 ? fan1Ref : fan2Ref}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, -0.03, 0]}
          >
            <torusGeometry args={[0.2, 0.035, 4, 4]} />
            <meshStandardMaterial
              color={isRunning ? "#22d3ee" : "#64748b"}
              emissive={isRunning ? "#06b6d4" : "#000000"}
              emissiveIntensity={isRunning ? 0.4 : 0}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ColdRoomDoor({
  position,
  isOpen,
  isRecovering,
  recoveryProgressPct,
  residualRise,
  onClick,
}: {
  position: [number, number, number];
  isOpen: boolean;
  isRecovering?: boolean;
  recoveryProgressPct?: number;
  residualRise?: number;
  onClick: () => void;
}) {
  const doorPanelRef = useRef<THREE.Mesh>(null);
  const targetX = isOpen ? position[0] + 1.2 : position[0];

  useFrame(() => {
    if (doorPanelRef.current) {
      doorPanelRef.current.position.x += (targetX - doorPanelRef.current.position.x) * 0.08;
    }
  });

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh position={[position[0] + 0.6, position[1] + 1.45, position[2]]}>
        <boxGeometry args={[2.6, 0.12, 0.15]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[position[0], position[1], position[2]]}>
        <boxGeometry args={[1.4, 2.7, 0.12]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      <mesh
        ref={doorPanelRef}
        position={[position[0], position[1], position[2] + 0.1]}
        castShadow
      >
        <boxGeometry args={[1.35, 2.65, 0.14]} />
        <meshStandardMaterial color={isOpen ? "#475569" : "#1e293b"} metalness={0.5} roughness={0.4} />
      </mesh>

      <Html position={[position[0], position[1] + 1.8, position[2]]} center distanceFactor={10}>
        <div
          onClick={onClick}
          className={`pointer-events-auto cursor-pointer font-mono text-[9px] px-2.5 py-1 rounded-lg border shadow-xl flex items-center gap-1.5 transition-all ${
            isOpen
              ? "bg-rose-950/95 border-rose-500 text-rose-300 animate-pulse shadow-rose-500/30"
              : isRecovering
              ? "bg-amber-950/95 border-amber-500/70 text-amber-200 shadow-amber-500/20"
              : "bg-slate-900/90 border-cyan-500/40 text-cyan-300 hover:border-cyan-400"
          }`}
        >
          <DoorOpen size={11} className={isOpen ? "text-rose-400" : isRecovering ? "text-amber-400" : "text-cyan-400"} />
          <span className="font-bold">
            {isOpen
              ? "DOOR OPEN (Click to Seal)"
              : isRecovering
              ? `SEALED • RECOVERING (${Math.round(recoveryProgressPct ?? 0)}%${(residualRise ?? 0) > 0 ? ` +${residualRise?.toFixed(1)}°C rise` : ""})`
              : "Door Sealed (Click to Open)"}
          </span>
        </div>
      </Html>
    </group>
  );
}

function DeliveryDockBay() {
  return (
    <group position={[11.5, 0, 1.2]}>
      <mesh position={[-0.8, 0.35, 0]} rotation={[0, 0, -0.06]}>
        <boxGeometry args={[1.2, 0.1, 1.8]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
      </mesh>

      {[-1, 1].map((bz, i) => (
        <mesh key={`dock-bumper-${i}`} position={[-0.3, 0.5, bz]}>
          <boxGeometry args={[0.15, 0.4, 0.15]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      ))}

      <mesh position={[2.2, 1.1, 0]} castShadow>
        <boxGeometry args={[3.2, 1.7, 2.0]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>

      <mesh position={[4.4, 0.75, 0]} castShadow>
        <boxGeometry args={[1.4, 1.2, 1.9]} />
        <meshStandardMaterial color="#38bdf8" roughness={0.3} />
      </mesh>

      <mesh position={[4.6, 0.95, 0]}>
        <boxGeometry args={[0.5, 0.5, 1.7]} />
        <meshStandardMaterial color="#0f172a" roughness={0.1} />
      </mesh>

      {[-0.6, 0.8, 2.8, 4.4].map((wx, wi) =>
        [-1.02, 1.02].map((wz, zi) => (
          <mesh key={`truck-wheel-${wi}-${zi}`} position={[wx, 0.3, wz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.28, 0.28, 0.18, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
        ))
      )}
    </group>
  );
}

function AirflowStreamlines({ isActive }: { isActive: boolean }) {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 250;

  const geo = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 19;
      pos[i * 3 + 1] = 0.2 + Math.random() * 3.1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6.5 - 2;
    }
    buffer.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return buffer;
  }, []);

  useFrame(() => {
    if (particlesRef.current && isActive) {
      const pos = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1] -= 0.015;
        pos[i * 3 + 2] += 0.008;

        if (pos[i * 3 + 1] < 0.1) {
          pos[i * 3 + 1] = 3.3;
          pos[i * 3] = (Math.random() - 0.5) * 19;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 6.5 - 2;
        }
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (!isActive) return null;

  return (
    <points ref={particlesRef} geometry={geo}>
      <pointsMaterial color="#38bdf8" size={0.04} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN 3D COLD STORAGE SCENE
   ═══════════════════════════════════════════════════════════════════ */

function ColdStorageScene({
  zones,
  selectedZoneId,
  onSelectZone,
  simulationState,
  cameraPreset,
  viewMode,
  showLabels,
  showCoverage,
  autoRotate,
  userInteracting,
  setUserInteracting,
  onToggleDoor,
  onHeadingChange,
  onNavigationProgress,
  isNavigating,
  controlsRef,
}: {
  zones: ZoneSummary[];
  selectedZoneId: string;
  onSelectZone: (id: string) => void;
  simulationState: {
    failedSensors: Set<string>;
    burnedSensors: Set<string>;
    accidentZones: Set<string>;
    fansActive: boolean;
    compressorRunning: boolean;
    doorOpen: boolean;
    isRecovering?: boolean;
    recoveryProgressPct?: number;
    residualRise?: number;
    zoneTemps: Record<string, number>;
  };
  cameraPreset: CameraPreset;
  viewMode: ViewDisplayMode;
  showLabels: boolean;
  showCoverage: boolean;
  autoRotate: boolean;
  userInteracting: boolean;
  setUserInteracting: (v: boolean) => void;
  onToggleDoor: () => void;
  onHeadingChange?: (heading: number) => void;
  onNavigationProgress?: (distanceMeters: number, isArrived: boolean) => void;
  isNavigating: boolean;
  controlsRef: React.MutableRefObject<any>;
}) {
  const getZoneTemp = (zoneId: string, defaultTemp: number) => {
    const live = (zones as ZoneSummary[])?.find((z) => z.zone_id === zoneId);
    return live?.temperature ?? simulationState.zoneTemps[zoneId] ?? defaultTemp;
  };

  const getStatus = (zoneId: string, temp: number, cfg: ZoneConfig): "normal" | "warning" | "critical" => {
    if (simulationState.accidentZones.has(zoneId)) return "critical";
    if (temp > cfg.upperLimit || temp < cfg.lowerLimit) return "critical";
    if (temp > cfg.upperLimit - 1.2 || temp < cfg.lowerLimit + 0.8) return "warning";
    return "normal";
  };

  const selectedZoneConfig = ZONE_CONFIGS.find((c) => c.id === selectedZoneId);

  return (
    <>
      <ambientLight intensity={0.4} color="#bae6fd" />
      <directionalLight
        position={[14, 18, 12]}
        intensity={0.8}
        color="#f0f9ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-12, 10, -10]} intensity={0.3} color="#93c5fd" />

      {/* Google Maps Smooth Camera Flight Controller */}
      <CameraRig
        preset={cameraPreset}
        autoRotate={autoRotate}
        userInteracting={userInteracting}
        setUserInteracting={setUserInteracting}
        onHeadingChange={onHeadingChange}
        onNavigationProgress={onNavigationProgress}
        controlsRef={controlsRef}
      />

      <WarehouseFloor />
      <BuildingShell viewMode={viewMode} />
      <ArchitecturalGuides cameraPreset={cameraPreset} viewMode={viewMode} />

      {/* Google Maps Animated Pin Marker over selected destination */}
      {selectedZoneConfig && (
        <MapLocationPin
          position={selectedZoneConfig.position}
          zoneName={selectedZoneConfig.name}
          color={selectedZoneConfig.color}
        />
      )}

      {/* Google Maps In-Floor Walking Direction Route */}
      <NavigationRoute targetZoneId={selectedZoneId} isNavigating={isNavigating} />

      {/* 3 Storage Zones */}
      {ZONE_CONFIGS.map((config) => {
        const temp = getZoneTemp(config.id, config.targetTemp);
        const status = getStatus(config.id, temp, config);
        const isFocused = selectedZoneId === config.id;

        return (
          <group key={config.id}>
            <ZoneFloor
              config={config}
              status={status}
              selected={isFocused}
              temp={temp}
              viewMode={viewMode}
              onClick={() => onSelectZone(config.id)}
            />
            <StorageRacks
              config={config}
              hasAccident={simulationState.accidentZones.has(config.id)}
              onSelectZone={() => onSelectZone(config.id)}
            />
            {simulationState.accidentZones.has(config.id) && <AccidentScene zoneId={config.id} />}
          </group>
        );
      })}

      {/* Floating Zone Badges in 3D Scene (matching reference layout) */}
      {ZONE_CONFIGS.map((config) => {
        const zoneData = (zones as ZoneSummary[])?.find((z) => z.zone_id === config.id);
        const temp = zoneData?.temperature ?? getZoneTemp(config.id, config.targetTemp);
        const humidity = zoneData?.humidity ?? (60 - (temp > 0 ? temp * 2 : 10));
        const isFocused = selectedZoneId === config.id;

        return (
          <group key={`billboard-${config.id}`} position={[config.position[0], 2.8, config.position[2] - 0.5]}>
            <Html center distanceFactor={11}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectZone(config.id);
                }}
                className={`px-3 py-2 rounded-xl backdrop-blur-md shadow-2xl transition-all cursor-pointer select-none border ${
                  isFocused
                    ? "bg-slate-950/90 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.35)] scale-105"
                    : "bg-slate-950/80 border-slate-700/80 hover:border-cyan-500/60 hover:bg-slate-900/90"
                }`}
                style={{ minWidth: "120px" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: config.color }} />
                  <span className="font-mono text-xs font-bold text-white tracking-wide">{config.name}</span>
                </div>
                <div className="space-y-0.5 font-mono text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <Thermometer size={12} className="text-cyan-400" />
                    <span className="font-bold text-white">{fmtTemp(temp)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Droplets size={12} className="text-blue-400" />
                    <span>{Math.round(humidity)}% RH</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Radio size={12} />
                    <span>2/2 Probes</span>
                  </div>
                </div>
              </div>
            </Html>
          </group>
        );
      })}

      {/* Sensor Nodes */}
      {ZONE_CONFIGS.map((config) => {
        const zoneData = (zones as ZoneSummary[])?.find((z) => z.zone_id === config.id);
        const temp = zoneData?.temperature ?? getZoneTemp(config.id, config.targetTemp);
        const humidity = zoneData?.humidity ?? (60 - (temp > 0 ? temp * 2 : 10));

        return config.sensorPositions.map((pos, idx) => {
          const sensorId = `${config.id.replace("zone-", "TS-").toUpperCase()}${idx + 1}`;
          const isFailed = simulationState.failedSensors.has(sensorId);
          const isBurned = simulationState.burnedSensors.has(sensorId);
          const hasAccident = simulationState.accidentZones.has(config.id);
          const isFocused = selectedZoneId === config.id;

          return (
            <SensorNode
              key={`${config.id}-sensor-${idx}`}
              position={pos}
              sensorId={sensorId}
              zoneId={config.id}
              zoneConfig={config}
              temperature={temp}
              humidity={humidity}
              airflow={1.4 + (zoneData?.compressor_load_pct ? (zoneData.compressor_load_pct / 100) * 0.8 : 0.2)}
              status={getStatus(config.id, temp, config)}
              isFailed={isFailed}
              isBurned={isBurned}
              hasAccident={hasAccident}
              isZoneFocused={isFocused}
              showLabel={showLabels}
              showCoverage={showCoverage}
              onSelect={() => onSelectZone(config.id)}
            />
          );
        });
      })}

      <Compressor
        position={[-8.8, 0, 2.2]}
        isRunning={simulationState.compressorRunning}
        isFailed={!simulationState.compressorRunning && simulationState.accidentZones.size > 0}
      />

      {ZONE_CONFIGS.map((config, i) => (
        <EvaporatorUnit
          key={`evap-${i}`}
          position={[config.position[0], 3.25, config.position[2]]}
          isRunning={simulationState.fansActive && simulationState.compressorRunning}
        />
      ))}

      <ColdRoomDoor
        position={[10.1, 1.35, -1.8]}
        isOpen={simulationState.doorOpen}
        isRecovering={simulationState.isRecovering}
        recoveryProgressPct={simulationState.recoveryProgressPct}
        residualRise={simulationState.residualRise}
        onClick={onToggleDoor}
      />

      <WarmAirIngress
        isOpen={simulationState.doorOpen}
        isRecovering={simulationState.isRecovering}
      />
      <DeliveryDockBay />

      <AirflowStreamlines isActive={simulationState.fansActive && simulationState.compressorRunning} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   🗺️ GOOGLE MAPS 2D RADAR MINIMAP WIDGET
   ═══════════════════════════════════════════════════════════════════ */

function RadarMinimap({
  selectedZoneId,
  onSelectZone,
  simulationState,
}: {
  selectedZoneId: string;
  onSelectZone: (id: string) => void;
  simulationState: {
    failedSensors: Set<string>;
    burnedSensors: Set<string>;
    accidentZones: Set<string>;
  };
}) {
  return (
    <div className="absolute bottom-3 right-3 z-20 w-44 rounded-xl border border-white/20 bg-slate-950/90 p-2 shadow-2xl backdrop-blur-md pointer-events-auto">
      <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 mb-1 pb-1 border-b border-white/10">
        <span className="flex items-center gap-1 font-bold">
          <Navigation size={10} className="animate-pulse" /> RADAR MINIMAP
        </span>
        <span className="text-[9px] text-fg-faint">2D GPS</span>
      </div>
      <div className="relative h-16 w-full rounded-lg bg-slate-900 border border-white/10 overflow-hidden flex items-center justify-center">
        {/* Radar concentric range circles */}
        <div className="absolute inset-2 rounded-full border border-cyan-500/20 pointer-events-none" />
        <div className="absolute inset-4 rounded-full border border-cyan-500/15 pointer-events-none" />
        {/* Radar sweep beam */}
        <div
          className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-500/15 to-transparent animate-spin origin-center pointer-events-none"
          style={{ animationDuration: "3.5s" }}
        />

        {/* Loading Dock Indicator */}
        <div className="absolute top-1/2 right-1.5 -translate-y-1/2 flex flex-col items-center">
          <div className="h-2 w-1 bg-amber-400/80 rounded" title="Loading Dock Bay" />
          <span className="text-[7px] text-amber-300/80 font-mono mt-0.5">DOCK</span>
        </div>

        {/* Zone Nodes */}
        <div className="absolute inset-x-2 inset-y-1 flex items-center justify-around">
          {ZONE_CONFIGS.map((cfg) => {
            const isSelected = selectedZoneId === cfg.id;
            const hasBurn = simulationState.burnedSensors.size > 0 && cfg.id === "zone-a";
            const hasFault = simulationState.accidentZones.has(cfg.id);

            return (
              <button
                key={`radar-${cfg.id}`}
                onClick={() => onSelectZone(cfg.id)}
                className="relative flex flex-col items-center group transition-transform hover:scale-110 cursor-pointer"
                title={`Fly to ${cfg.name}`}
              >
                <div
                  className={`h-4 w-4 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? "ring-2 ring-cyan-400 bg-cyan-400/40 shadow-[0_0_10px_#22d3ee]"
                      : "bg-slate-800 border border-white/30 hover:border-cyan-400"
                  } ${hasBurn ? "bg-red-500 animate-ping" : hasFault ? "bg-amber-500 animate-pulse" : ""}`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />
                </div>
                <span className={`text-[8px] font-mono mt-0.5 font-bold ${isSelected ? "text-cyan-300" : "text-fg-faint"}`}>
                  {cfg.name.replace("Zone ", "")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   🧭 GOOGLE MAPS TURN-BY-TURN TOP NAVIGATION BANNER
   ═══════════════════════════════════════════════════════════════════ */

function GoogleMapsTopNavBanner({
  zoneConfig,
  distanceMeters,
  isArrived,
  onExit,
  onRecenter,
  onWalkInside,
}: {
  zoneConfig: ZoneConfig;
  distanceMeters: number;
  isArrived: boolean;
  onExit: () => void;
  onRecenter: () => void;
  onWalkInside: () => void;
}) {
  const getManeuver = () => {
    if (zoneConfig.id === "zone-a") {
      return {
        icon: <ChevronLeft size={22} className="text-emerald-300 stroke-[3]" />,
        text: isArrived ? "Arrived at Zone A (Vaccines & Biologics)" : "Turn left into Aisle 1 • Vaccine Storage",
        subtext: "Pharmaceutical Cryogenic Racks (Safe: +2°C to +8°C)",
      };
    } else if (zoneConfig.id === "zone-b") {
      return {
        icon: <ArrowUp size={22} className="text-emerald-300 stroke-[3]" />,
        text: isArrived ? "Arrived at Zone B (Dairy & Fresh Produce)" : "Continue straight down Central Transit Aisle",
        subtext: "Commercial Produce Chillers (Safe: 0°C to +6°C)",
      };
    } else {
      return {
        icon: <ChevronRight size={22} className="text-emerald-300 stroke-[3]" />,
        text: isArrived ? "Arrived at Zone C (Deep Freeze & Airlock)" : "Turn right into Aisle 3 • Deep Freeze Bay",
        subtext: "Rapid-Roll Insulated Airlock Dock (Safe: -25°C to -15°C)",
      };
    }
  };

  const maneuver = getManeuver();

  return (
    <div className="px-3 py-2 border-b border-emerald-500/30 bg-gradient-to-r from-emerald-950 via-slate-950 to-emerald-950 text-white flex items-center justify-between gap-3 shadow-xl backdrop-blur-md flex-wrap animate-in slide-in-from-top duration-300">
      {/* Big Google Maps Maneuver Arrow & Direction */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-600/90 border border-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
          {maneuver.icon}
        </div>
        <div>
          <div className="text-sm font-bold flex items-center gap-2">
            <span>{maneuver.text}</span>
            {isArrived && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400 font-bold uppercase animate-pulse">
                ARRIVED
              </span>
            )}
          </div>
          <div className="text-[11px] text-emerald-300/80 font-mono">
            {maneuver.subtext}
          </div>
        </div>
      </div>

      {/* Dynamic Distance & GPS Status Ticker */}
      <div className="flex items-center gap-3 font-mono text-xs">
        <div className="hidden sm:flex flex-col items-end">
          <div className="text-emerald-300 font-bold text-sm">
            {isArrived ? "0 m" : `${Math.max(1, Math.round(distanceMeters))} m`}
          </div>
          <div className="text-[9px] text-fg-faint">
            {isArrived ? "Destination reached" : "Speed: 1.4 m/s • ETA: 3s"}
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] text-emerald-300 font-bold">
          <Signal size={11} className="text-emerald-400 animate-pulse" />
          <span>GPS RTK LOCKED</span>
        </div>

        {/* Header Quick Actions */}
        <div className="flex items-center gap-1 border-l border-emerald-500/30 pl-2">
          <button
            onClick={onRecenter}
            className="p-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-400/30 cursor-pointer transition-all"
            title="Re-Center Camera"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={onWalkInside}
            className="p-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-400/30 cursor-pointer transition-all"
            title="Street View Inside Aisle"
          >
            <Footprints size={14} />
          </button>
          <button
            onClick={onExit}
            className="px-2 py-1 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-200 border border-red-500/40 font-mono text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-md"
            title="Exit Navigation"
          >
            <X size={13} />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   🧭 GOOGLE MAPS STYLE BOTTOM DOCKED PLACE BAR (NON-BLOCKING!)
   ═══════════════════════════════════════════════════════════════════ */

function GoogleMapsBottomDock({
  zoneConfig,
  currentTemp,
  simulationState,
  activeZone,
  onExitNavigation,
  onCycleNextZone,
  onWalkInside,
  onRecenter,
}: {
  zoneConfig: ZoneConfig;
  currentTemp: number;
  simulationState: {
    failedSensors: Set<string>;
    burnedSensors: Set<string>;
    accidentZones: Set<string>;
    doorOpen: boolean;
    compressorRunning: boolean;
  };
  activeZone?: ZoneSummary | null;
  onExitNavigation: () => void;
  onCycleNextZone: () => void;
  onWalkInside: () => void;
  onRecenter: () => void;
}) {
  const [showProbeDetails, setShowProbeDetails] = useState(false);
  const isOutOfBand = currentTemp > zoneConfig.upperLimit || currentTemp < zoneConfig.lowerLimit;
  const isNearLimit = currentTemp > zoneConfig.upperLimit - 1.2 || currentTemp < zoneConfig.lowerLimit + 0.8;

  const tempStatusBadge = isOutOfBand
    ? "text-rose-400 bg-rose-500/20 border-rose-500/50"
    : isNearLimit
    ? "text-amber-400 bg-amber-500/20 border-amber-500/50"
    : "text-emerald-400 bg-emerald-500/20 border-emerald-500/50";

  return (
    <div className="absolute bottom-3 left-3 right-16 sm:right-48 z-30 pointer-events-auto transition-all animate-in slide-in-from-bottom duration-300">
      {/* Optional Expanded Probe Drawer (collapsible, doesn't block screen) */}
      {showProbeDetails && (
        <div className="mb-2 p-3 rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
              <Radio size={13} className="text-cyan-400" />
              {zoneConfig.name} Redundant RTD Sensor Array
            </span>
            <button
              onClick={() => setShowProbeDetails(false)}
              className="text-fg-faint hover:text-white p-1 rounded-full cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {zoneConfig.sensors.map((s) => {
              const isBurned = simulationState.burnedSensors.has(s.id);
              const isFailed = simulationState.failedSensors.has(s.id);
              const sTemp = Number(currentTemp.toFixed(1));
              return (
                <div
                  key={s.id}
                  className={`p-2.5 rounded-xl border font-mono text-xs ${
                    isBurned
                      ? "border-red-500 bg-red-950/40 text-red-200"
                      : isFailed
                      ? "border-rose-500 bg-rose-950/40 text-rose-200"
                      : "border-white/10 bg-slate-900/80 text-fg"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${isBurned ? "bg-red-500 animate-ping" : isFailed ? "bg-rose-500" : "bg-emerald-400"}`} />
                      {s.id}
                    </span>
                    <span className="text-[10px] text-fg-muted">{s.type}</span>
                  </div>
                  <div className="text-[10px] text-fg-faint mt-1">{s.location}</div>
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5">
                    <span className="text-[11px] font-bold text-white">Live: {fmtTemp(sTemp)}</span>
                    <span className="text-[9px] text-fg-faint">Cal: {s.calibrationDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sleek Docked Navigation Bottom Bar */}
      <div className="rounded-2xl border border-cyan-500/40 bg-slate-950/90 shadow-2xl backdrop-blur-xl p-2.5 flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Zone Thumbnail & Title */}
        <div className="flex items-center gap-2.5">
          <div className="relative h-11 w-11 rounded-xl overflow-hidden border border-white/20 shrink-0 group">
            <img
              src={zoneConfig.image}
              alt={zoneConfig.name}
              className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={14} className="text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <MapPin size={13} className="text-cyan-400 shrink-0" />
              <span className="font-bold text-white text-xs sm:text-sm">{zoneConfig.name}</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${tempStatusBadge}`}>
                {fmtTemp(currentTemp)}
              </span>
            </div>
            <div className="text-[10px] text-cyan-300 font-mono">{zoneConfig.product} • Safe: {zoneConfig.tempRange}</div>
          </div>
        </div>

        {/* Center: Live Telemetry Chips */}
        <div className="hidden lg:flex items-center gap-2 font-mono text-[11px]">
          <div className="rounded-lg bg-slate-900/90 border border-white/10 px-2.5 py-1 flex items-center gap-1.5">
            <Droplets size={12} className="text-blue-400" />
            <span className="text-fg-faint">RH:</span>
            <span className="font-bold text-white">{activeZone?.humidity != null ? `${activeZone.humidity.toFixed(0)}%` : "52%"}</span>
          </div>
          <div className="rounded-lg bg-slate-900/90 border border-white/10 px-2.5 py-1 flex items-center gap-1.5">
            <Zap size={12} className="text-amber-400" />
            <span className="text-fg-faint">Power:</span>
            <span className="font-bold text-amber-300">{activeZone?.power_consumption_kw != null ? `${activeZone.power_consumption_kw.toFixed(1)} kW` : "— kW"}</span>
          </div>
          <div className="rounded-lg bg-slate-900/90 border border-white/10 px-2.5 py-1 flex items-center gap-1.5">
            <Radio size={12} className="text-emerald-400" />
            <span className="text-fg-faint">Status:</span>
            <span className={`font-bold ${activeZone?.sensor_health && activeZone.sensor_health !== "healthy" ? "text-amber-400" : "text-emerald-300"}`}>
              {activeZone?.sensor_health && activeZone.sensor_health !== "healthy" ? activeZone.sensor_health.replace("_", " ") : "Sensors OK"}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => setShowProbeDetails(!showProbeDetails)}
            className={`px-2.5 py-1.5 text-[11px] font-mono rounded-lg border flex items-center gap-1 cursor-pointer transition-all ${
              showProbeDetails
                ? "bg-cyan-500/20 text-cyan-200 border-cyan-400 font-bold"
                : "bg-slate-900 text-fg-muted border-white/10 hover:text-white"
            }`}
            title="Inspect individual sensor probes"
          >
            <Radio size={12} />
            <span className="hidden sm:inline">Probes</span>
          </button>

          <button
            onClick={onWalkInside}
            className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border bg-slate-900 text-fg-muted border-white/10 hover:text-white hover:border-cyan-400/50 flex items-center gap-1 cursor-pointer transition-all"
            title="Eye-level aisle street view"
          >
            <Footprints size={12} className="text-cyan-400" />
            <span className="hidden sm:inline">Street View</span>
          </button>

          <button
            onClick={onRecenter}
            className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border bg-slate-900 text-fg-muted border-white/10 hover:text-white flex items-center gap-1 cursor-pointer transition-all"
            title="Re-center navigation camera"
          >
            <RotateCcw size={12} className="text-amber-400" />
            <span className="hidden sm:inline">Re-Center</span>
          </button>

          <button
            onClick={onCycleNextZone}
            className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border bg-cyan-500/20 text-cyan-200 border-cyan-400 hover:bg-cyan-500/30 font-bold flex items-center gap-1 cursor-pointer transition-all shadow-md"
            title="Fly to next zone"
          >
            <Navigation size={12} />
            <span>Next Zone</span>
            <ChevronRight size={12} />
          </button>

          <button
            onClick={onExitNavigation}
            className="p-1.5 rounded-lg bg-red-950/40 text-red-300 hover:bg-red-950/80 border border-red-500/30 cursor-pointer transition-all"
            title="Exit Navigation (Overview Map)"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN DIGITAL TWIN PAGE EXPORT
   ═══════════════════════════════════════════════════════════════════ */

export default function DigitalTwin() {
  const { zones, selectedZone, selectedZoneId, setSelectedZoneId, zonesError, health } = useApp();

  // Live shared zones from AppContext (SSE stream + fallback)
  const allZones = zones ?? [];

  const readings = usePolling(() => api.readings(selectedZoneId, 60), POLL_MS, [selectedZoneId]);
  const forecast = usePolling(() => api.forecast(selectedZoneId, 30), POLL_MS, [selectedZoneId]);
  const riskPoll = usePolling(() => api.risk(selectedZoneId, 30), POLL_MS, [selectedZoneId]);
  const alertsPoll = usePolling(() => api.alerts({ active: true, limit: 15 }), POLL_MS);
  const recoveryPoll = usePolling(() => api.recoveryStatus(selectedZoneId), POLL_MS, [selectedZoneId]);
  const doorEventsPoll = usePolling(() => api.doorEvents(selectedZoneId, 15), POLL_MS, [selectedZoneId]);
  const facilityEventsPoll = usePolling(() => api.events(25), POLL_MS, []);

  // Telemetry freshness tracking
  const [lastTelemetryTimestamp, setLastTelemetryTimestamp] = useState<Date>(new Date());
  const [secondsSinceLastUpdate, setSecondsSinceLastUpdate] = useState<number>(0);

  useEffect(() => {
    if (allZones.length > 0) {
      setLastTelemetryTimestamp(new Date());
      setSecondsSinceLastUpdate(0);
    }
  }, [allZones]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceLastUpdate((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isDataStale = secondsSinceLastUpdate > 75;

  // 3D Viewport Controls State
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("isometric");
  const [viewMode, setViewMode] = useState<ViewDisplayMode>("standard");
  const [showLabels, setShowLabels] = useState(true);
  const [showCoverage, setShowCoverage] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [userInteracting, setUserInteracting] = useState(false);
  const [compassHeading, setCompassHeading] = useState(0);
  const [is3DExpanded, setIs3DExpanded] = useState(false);

  const controlsRef = useRef<any>(null);

  // Consequential Simulation Command Confirmation State
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    impact: string;
    actionLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Simulation Drawer / Modal Open State
  const [showScenarioDrawer, setShowScenarioDrawer] = useState<boolean>(false);

  // Analytics Panel State (Region D)
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<"forecast" | "what-if" | "matrix" | "events" | "health">("forecast");
  const [liveClock, setLiveClock] = useState(() => new Date().toLocaleTimeString());
  useEffect(() => {
    const t = setInterval(() => setLiveClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState<boolean>(false);

  // Counterfactual What-If Simulator State (Inside Tab 1)
  const [forecastMode, setForecastMode] = useState<"live" | "whatif">("live");
  const [whatIfScenario, setWhatIfScenario] = useState<WhatIfScenarioId>("door_open");
  const [whatIfDuration, setWhatIfDuration] = useState<number>(5);
  const [whatIfLoading, setWhatIfLoading] = useState<boolean>(false);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResponse | null>(null);

  // Timeline Filter State (Inside Tab 3)
  const [timelineSeverityFilter, setTimelineSeverityFilter] = useState<string>("all");

  // Synchronized Simulation State (Directly driven by live backend telemetry)
  const [simState, setSimState] = useState({
    failedSensors: new Set<string>(),
    burnedSensors: new Set<string>(),
    accidentZones: new Set<string>(),
    fansActive: true,
    compressorRunning: true,
    doorOpen: false,
    isRecovering: false,
    recoveryProgressPct: 100,
    residualRise: 0,
    peakTemp: null as number | null,
    recoveryMinutes: 0,
    zoneTemps: {
      "zone-a": 5.0,
      "zone-b": 3.0,
      "zone-c": -20.0,
    } as Record<string, number>,
  });

  const [activeScenario, setActiveScenario] = useState<SimulationScenario>("normal");
  const [doorOpenSeconds, setDoorOpenSeconds] = useState(0);

  // Activity Log
  const [activityLog, setActivityLog] = useState<SensorEvent[]>([
    { time: "14:30", message: "Cold storage facility nominal operation", type: "info", zone: "Facility" },
    { time: "14:20", message: "Defrost cycle completed on schedule", type: "info", zone: "Zone A" },
    { time: "14:05", message: "Dual compressor operating at 78% capacity", type: "info", zone: "System" },
  ]);

  const addEvent = useCallback((message: string, type: SensorEvent["type"], zone: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setActivityLog((prev) => [{ time, message, type, zone }, ...prev.slice(0, 9)]);
  }, []);

  // Sync DigitalTwin simState with the unified live backend stream (SSE / REST)
  useEffect(() => {
    if (allZones.length > 0) {
      const zA = allZones.find((z) => z.zone_id === "zone-a");
      const zB = allZones.find((z) => z.zone_id === "zone-b");
      const zC = allZones.find((z) => z.zone_id === "zone-c");
      const curr = allZones.find((z) => z.zone_id === selectedZoneId) || zC || allZones[0];

      const isDoorOpen = curr?.door_status === "open";
      const isCompFailed = allZones.some((z) => z.compressor_status === "failed" || z.compressor_status === "stopped");
      const isDegraded = allZones.some((z) => z.compressor_status === "degraded");
      const isSensorAnomaly = allZones.some((z) => z.scenario === "sensor_anomaly" || z.sensor_health === "spike_anomaly" || z.sensor_health === "stuck_frozen");

      const isRecovering = (curr?.recovery_phase && curr.recovery_phase !== "none" && curr.recovery_phase !== "recovered") || (curr?.residual_rise_predicted ?? 0) > 0.05;

      if (isDoorOpen) {
        setActiveScenario("door_open");
        setDoorOpenSeconds((s) => s + 1);
      } else if (isCompFailed) {
        setActiveScenario("compressor_failure");
      } else if (isDegraded) {
        setActiveScenario("cooling_degradation");
      } else if (isSensorAnomaly) {
        setActiveScenario("sensor_burn");
      } else {
        setActiveScenario("normal");
        setDoorOpenSeconds(0);
      }

      setSimState((prev) => ({
        ...prev,
        doorOpen: isDoorOpen,
        isRecovering,
        recoveryProgressPct: curr?.recovery_progress_pct ?? 100,
        residualRise: curr?.residual_rise_predicted ?? 0,
        peakTemp: curr?.peak_temp_predicted ?? null,
        recoveryMinutes: curr?.recovery_time_minutes ?? 0,
        compressorRunning: !isCompFailed,
        fansActive: !isCompFailed,
        zoneTemps: {
          "zone-a": zA?.temperature ?? 5.0,
          "zone-b": zB?.temperature ?? 3.0,
          "zone-c": zC?.temperature ?? -20.0,
        },
      }));
    }
  }, [allZones, selectedZoneId]);

  // 🧭 Google Maps Turn-by-Turn Navigation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [navDistance, setNavDistance] = useState(16);
  const [navArrived, setNavArrived] = useState(false);

  // 🚀 GOOGLE MAPS FLIGHT NAVIGATION TO ZONE (NO STATIC MODAL!)
  const handleZoneSelect = useCallback(
    (zoneId: string) => {
      setSelectedZoneId(zoneId);
      setIsNavigating(true);
      setNavArrived(false);
      // Smoothly fly camera to close-up view of this zone
      setCameraPreset(zoneId as CameraPreset);
      const cfg = ZONE_CONFIGS.find((c) => c.id === zoneId);
      addEvent(`📍 Navigated camera to ${cfg?.name ?? zoneId} (${cfg?.product})`, "info", cfg?.name ?? zoneId);
    },
    [setSelectedZoneId, addEvent]
  );

  const handleNavigationProgress = useCallback((distanceMeters: number, arrived: boolean) => {
    setNavDistance(distanceMeters);
    setNavArrived(arrived);
  }, []);

  const handleExitNavigation = useCallback(() => {
    setIsNavigating(false);
    setNavArrived(false);
    setCameraPreset("isometric");
    addEvent("🌐 Returned camera to facility overview map", "info", "Overview");
  }, [addEvent]);

  const handleWalkInside = useCallback(() => {
    setCameraPreset("aisle-walk");
    addEvent("🚶 Stepped into eye-level aisle street view", "info", "Aisle");
  }, [addEvent]);

  const handleRecenter = useCallback(() => {
    setCameraPreset(selectedZoneId as CameraPreset);
    setNavArrived(false);
  }, [selectedZoneId]);

  // Cycle to next zone in sequence
  const handleCycleNextZone = useCallback(() => {
    const ids = ["zone-a", "zone-b", "zone-c"];
    const currIdx = ids.indexOf(selectedZoneId);
    const nextId = ids[(currIdx + 1) % ids.length];
    handleZoneSelect(nextId);
  }, [selectedZoneId, handleZoneSelect]);

  // Toggle Door simulation statefully via backend API
  const handleToggleDoor = useCallback(async () => {
    const targetZoneId = selectedZoneId || "zone-c";
    const targetConfig = ZONE_CONFIGS.find((c) => c.id === targetZoneId);
    const willOpen = !simState.doorOpen;
    try {
      await api.setDoor(targetZoneId, willOpen ? "open" : "closed");
      if (willOpen) {
        setActiveScenario("door_open");
        setDoorOpenSeconds(0);
        addEvent(`🚪 ${targetConfig?.name ?? targetZoneId} DOOR OPENED: Ambient thermal ingress active`, "warning", targetConfig?.name ?? "Chamber");
      } else {
        setActiveScenario("normal");
        addEvent(`✓ ${targetConfig?.name ?? targetZoneId} door sealed; post-closure cooling recovery initiated (risk retained)`, "info", targetConfig?.name ?? "Chamber");
      }
      setSimState((prev) => ({
        ...prev,
        doorOpen: willOpen,
        isRecovering: !willOpen,
      }));
    } catch (err) {
      console.error("Failed to toggle door:", err);
    }
  }, [addEvent, selectedZoneId, simState.doorOpen]);


  // Consequential Action Request with Safety Confirmation Modal
  const requestConfirmation = useCallback(
    (title: string, description: string, impact: string, actionLabel: string, action: () => Promise<void>) => {
      setConfirmModal({
        open: true,
        title,
        description,
        impact,
        actionLabel,
        onConfirm: async () => {
          try {
            await action();
          } catch (err) {
            console.error("Action execution error:", err);
          } finally {
            setConfirmModal(null);
          }
        },
      });
    },
    []
  );

  // Degrade Cooling
  const handleDegradeCooling = useCallback(() => {
    setActiveScenario("cooling_degradation");
    addEvent("⚠️ COOLING DEGRADATION INJECTED: Compressor efficiency down 45%", "warning", "System");
    api.setScenario("zone-a", "cooling_degradation").catch(() => {});
  }, [addEvent]);

  // Trip / Restore Compressor
  const handleToggleCompressor = useCallback(() => {
    const willRun = !simState.compressorRunning;
    if (!willRun) {
      requestConfirmation(
        "Trip Primary Compressor Rack (Simulation)",
        "This simulated fault will shut down the primary refrigeration unit, halting active cooling across the entire facility.",
        "Expected outcome: Chamber temperatures will begin positive thermal drift (+0.5°C to +1.8°C/hr). Excursion risk will elevate to CRITICAL.",
        "⚡ Trip Compressor Rack",
        async () => {
          setActiveScenario("compressor_failure");
          addEvent("⚠ PRIMARY COMPRESSOR RACK TRIPPED: Facility cooling lost", "critical", "System");
          await api.setScenario("zone-a", "compressor_failure").catch(() => {});
          setSimState((prev) => ({ ...prev, compressorRunning: false, fansActive: false }));
        }
      );
    } else {
      setActiveScenario("normal");
      addEvent("✓ Compressor rack restored; active refrigeration online", "info", "System");
      api.reset("scenario").catch(() => {});
      setSimState((prev) => ({ ...prev, compressorRunning: true, fansActive: true }));
    }
  }, [simState.compressorRunning, addEvent, requestConfirmation]);

  // Burn Sensor
  const handleBurnSensor = useCallback(() => {
    const isBurned = simState.burnedSensors.has("TS-A1");
    if (!isBurned) {
      requestConfirmation(
        "Inject Sensor Hardware Failure (TS-A1)",
        "This will inject an unsupervised spike anomaly / thermal runaway into sensor TS-A1 in Zone A.",
        "Expected outcome: Isolation Forest will detect outlier score >0.95. Telemetry from probe TS-A1 will be untrusted.",
        "🔥 Trigger Sensor Fault",
        async () => {
          setSimState((prev) => {
            const next = new Set(prev.burnedSensors);
            next.add("TS-A1");
            return { ...prev, burnedSensors: next };
          });
          setActiveScenario("sensor_burn");
          addEvent("🔥 SENSOR HARDWARE FAULT: TS-A1 thermal runaway detected", "critical", "Zone A");
          handleZoneSelect("zone-a");
          await api.setScenario("zone-a", "sensor_anomaly").catch(() => {});
        }
      );
    } else {
      setSimState((prev) => {
        const next = new Set(prev.burnedSensors);
        next.delete("TS-A1");
        return { ...prev, burnedSensors: next };
      });
      setActiveScenario("normal");
      addEvent("✓ Sensor TS-A1 replaced and recalibrated", "info", "Zone A");
      api.reset("scenario", "zone-a").catch(() => {});
    }
  }, [simState.burnedSensors, addEvent, handleZoneSelect, requestConfirmation]);

  // Degrade Cooling Capacity (Condenser Fouling / Refrigerant Leak)
  const handleToggleDegradation = useCallback(() => {
    if (activeScenario === "cooling_degradation") {
      setActiveScenario("normal");
      addEvent("✓ Cooling system restored to full nominal capacity", "info", "Zone A");
      api.reset("scenario", "zone-a").catch(() => {});
    } else {
      requestConfirmation(
        "Simulate Cooling Capacity Degradation (45% Loss)",
        "Simulate condenser coil fouling and partial refrigerant pressure loss in Zone A.",
        "Expected outcome: Compressor will run under continuous strain with reduced COP (Coefficient of Performance). Zone temperature will slowly rise.",
        "📉 Degrade Cooling Unit",
        async () => {
          setActiveScenario("cooling_degradation");
          addEvent("📉 COOLING DEGRADATION: 45% capacity loss & compressor strain", "warning", "Zone A");
          handleZoneSelect("zone-a");
          await api.setScenario("zone-a", "cooling_degradation").catch(() => {});
        }
      );
    }
  }, [activeScenario, addEvent, handleZoneSelect, requestConfirmation]);

  // Reset Everything to Nominal Baseline
  const handleResetAll = useCallback(() => {
    setActiveScenario("normal");
    setDoorOpenSeconds(0);
    setSimState({
      failedSensors: new Set(),
      burnedSensors: new Set(),
      accidentZones: new Set(),
      fansActive: true,
      compressorRunning: true,
      doorOpen: false,
      isRecovering: false,
      recoveryProgressPct: 100,
      residualRise: 0,
      peakTemp: null,
      recoveryMinutes: 0,
      zoneTemps: {
        "zone-a": 5.0,
        "zone-b": 3.0,
        "zone-c": -20.0,
      },
    });
    setCameraPreset("isometric");
    addEvent("✓ All systems, sensors, and doors reset to nominal baseline", "info", "Facility");
    api.reset("full").catch(() => {});
  }, [addEvent]);

  // Counterfactual What-If Simulation Runner
  const handleRunWhatIf = useCallback(async () => {
    setWhatIfLoading(true);
    try {
      const res = await api.whatIf({
        zone_id: selectedZoneId || "zone-c",
        scenario: whatIfScenario,
        duration_minutes: whatIfScenario === "door_open" ? whatIfDuration : null,
        ambient_delta: 15.0,
        projection_minutes: 60,
      });
      setWhatIfResult(res);
      addEvent(`🧪 Executed counterfactual what-if simulation for ${res.scenario_label}`, "info", selectedZoneId);
    } catch (err) {
      console.error("Counterfactual what-if failed:", err);
      addEvent("❌ Counterfactual simulation request failed", "warning", selectedZoneId);
    } finally {
      setWhatIfLoading(false);
    }
  }, [selectedZoneId, whatIfScenario, whatIfDuration, addEvent]);

  // Auto-run What-If when entering What-If tab or switching scenario
  useEffect(() => {
    if (activeAnalyticsTab === "forecast" && forecastMode === "whatif" && !whatIfResult) {
      handleRunWhatIf();
    }
  }, [activeAnalyticsTab, forecastMode, whatIfResult, handleRunWhatIf]);

  // Google Maps Zoom in/out handlers
  const handleZoom = (delta: number) => {
    if (controlsRef.current) {
      const cam = controlsRef.current.object;
      const target = controlsRef.current.target;
      const dir = new THREE.Vector3().subVectors(cam.position, target);
      const factor = delta > 0 ? 0.8 : 1.25;
      dir.multiplyScalar(factor);
      cam.position.copy(target).add(dir);
      controlsRef.current.update();
    }
  };

  const handleResetNorth = () => {
    setCameraPreset("top");
  };

  const selectedConfig = useMemo(
    () => ZONE_CONFIGS.find((c) => c.id === selectedZoneId) ?? ZONE_CONFIGS[0],
    [selectedZoneId]
  );

  const currentZoneTemp = simState.zoneTemps[selectedZoneId] ?? selectedConfig.targetTemp;

  // Explainable Risk Score (Synchronized with backend AI risk engine + real-time simulation)
  const riskAnalysis = useMemo(() => {
    let localScore = 2;
    const localFactors: { label: string; detail: string; points: number }[] = [];

    if (simState.doorOpen) {
      const doorPts = Math.min(45, 20 + doorOpenSeconds * 2);
      localScore += doorPts;
      localFactors.push({
        label: "Loading Door Ingress",
        detail: `Dock door open for ${Math.floor(doorOpenSeconds / 60)}m ${doorOpenSeconds % 60}s allowing +26.0°C ambient heat rush`,
        points: doorPts,
      });
    }

    if (simState.isRecovering || (selectedZone?.residual_rise_predicted ?? 0) > 0.05) {
      const residualRise = selectedZone?.residual_rise_predicted ?? simState.residualRise ?? 0.5;
      const recMins = selectedZone?.recovery_time_minutes ?? simState.recoveryMinutes ?? 15;
      const recProg = selectedZone?.recovery_progress_pct ?? simState.recoveryProgressPct ?? 40;
      const recPts = Math.min(35, Math.max(15, Math.round((100 - recProg) * 0.35)));
      localScore += recPts;
      localFactors.push({
        label: "Post-Closure Residual Thermal Heat",
        detail: `Door sealed. Trapped warm air entering thermal inertia wave (ΔT residual +${residualRise.toFixed(1)}°C, est. recovery ~${Math.round(recMins)} min, ${Math.round(recProg)}% complete). Risk retained during recovery phase.`,
        points: recPts,
      });
    }

    if (!simState.compressorRunning) {
      localScore += 55;
      localFactors.push({
        label: "Refrigeration Unit Offline",
        detail: "Primary compressor rack tripped; loss of active cooling across facility",
        points: 55,
      });
    }

    if (simState.burnedSensors.has("TS-A1") && selectedZoneId === "zone-a") {
      localScore += 35;
      localFactors.push({
        label: "Sensor Hardware Failure",
        detail: "Probe TS-A1 thermal runaway detected; telemetry untrusted",
        points: 35,
      });
    }

    if (currentZoneTemp > selectedConfig.upperLimit) {
      const breachPts = 40;
      localScore += breachPts;
      localFactors.push({
        label: "Critical Limit Exceeded",
        detail: `Current temp (${fmtTemp(currentZoneTemp)}) exceeds upper limit (${fmtTemp(selectedConfig.upperLimit)})`,
        points: breachPts,
      });
    } else if (currentZoneTemp > selectedConfig.upperLimit - 1.5) {
      const warnPts = 25;
      localScore += warnPts;
      localFactors.push({
        label: "Approaching Excursion Threshold",
        detail: `Positive drift nearing critical boundary of ${fmtTemp(selectedConfig.upperLimit)}`,
        points: warnPts,
      });
    }

    // Unify score: prioritize live backend risk score if active, fallback to simulation score
    const backendScore = selectedZone?.risk_score ?? riskPoll.data?.score;
    const score = backendScore != null && backendScore > 0
      ? Math.max(backendScore, Math.min(100, localScore))
      : Math.min(100, Math.max(0, localScore));

    const category = selectedZone?.risk_category ?? riskPoll.data?.category ?? (score > 70 ? "critical" : score > 35 ? "warning" : "low");

    // Unify factors: combine backend factors with local simulation events
    const factors = [...localFactors];
    if (riskPoll.data?.factors?.length) {
      for (const bf of riskPoll.data.factors) {
        if (!factors.some((f) => f.label === bf.label)) {
          factors.push({
            label: bf.label,
            detail: bf.detail,
            points: Math.round(bf.points),
          });
        }
      }
    }

    let recommendation = "All systems operating within specifications. Routine monitoring active.";
    let actionLabel: string | null = null;
    let onAction: (() => void) | null = null;

    if (simState.doorOpen) {
      recommendation = `CRITICAL ACTION: Close ${selectedConfig.name} door immediately. Seal magnetic gaskets and engage booster blower to prevent excursion.`;
      actionLabel = `⚡ Seal Door & Stop Ingress`;
      onAction = handleToggleDoor;
    } else if (simState.isRecovering || (selectedZone?.residual_rise_predicted ?? 0) > 0.05) {
      const recMins = selectedZone?.recovery_time_minutes ?? simState.recoveryMinutes ?? 12;
      recommendation = `RECOVERY IN PROGRESS: Chamber door sealed. Active refrigeration working against trapped thermal inertia. Predicted peak temp ${selectedZone?.peak_temp_predicted ? `${selectedZone.peak_temp_predicted.toFixed(1)}°C` : "elevated"}. Full recovery in ~${Math.round(recMins)} min. Avoid reopening doors.`;
      actionLabel = null;
      onAction = null;
    } else if (!simState.compressorRunning) {
      recommendation = "URGENT ACTION: Reset compressor breaker panel; switch to secondary backup condensing unit and notify HVAC technician.";
      actionLabel = "⚡ Reset Compressor & Restore Cooling";
      onAction = handleToggleCompressor;
    } else if (simState.burnedSensors.has("TS-A1")) {
      recommendation = "HARDWARE ACTION: Isolate sensor TS-A1 circuit breaker. Switch thermostat control feedback to redundant probe TS-A2.";
      actionLabel = "⚡ Isolate TS-A1 & Recalibrate";
      onAction = handleBurnSensor;
    }

    return { score, category, factors, recommendation, actionLabel, onAction };
  }, [simState, doorOpenSeconds, currentZoneTemp, selectedConfig, selectedZoneId, selectedZone, riskPoll.data, handleToggleDoor, handleToggleCompressor, handleBurnSensor]);

  // Live Forecast Points
  const forecastData = useMemo(() => {
    if (forecast.data?.points?.length) {
      const baseTemp = forecast.data.base_temperature ?? currentZoneTemp;
      const pts = [
        {
          minute: "0m",
          temperature: baseTemp,
          upperLimit: selectedConfig.upperLimit,
          lowerLimit: selectedConfig.lowerLimit,
        },
      ];
      for (const p of forecast.data.points) {
        pts.push({
          minute: `${p.minutes_ahead}m`,
          temperature: p.temperature,
          upperLimit: selectedConfig.upperLimit,
          lowerLimit: selectedConfig.lowerLimit,
        });
      }
      return pts;
    }

    const points = [];
    const driftRate = simState.doorOpen && selectedZoneId === "zone-c"
      ? 0.7
      : !simState.compressorRunning
      ? 0.5
      : 0.05;

    for (let min = 0; min <= 30; min += 5) {
      const projected = Number((currentZoneTemp + (min / 5) * driftRate).toFixed(2));
      points.push({
        minute: `${min}m`,
        temperature: projected,
        upperLimit: selectedConfig.upperLimit,
        lowerLimit: selectedConfig.lowerLimit,
      });
    }
    return points;
  }, [currentZoneTemp, simState, selectedZoneId, selectedConfig, forecast.data]);

  // Counterfactual Chart Data
  const counterfactualChartData = useMemo(() => {
    if (!whatIfResult) return [];
    const maxLen = Math.max(
      whatIfResult.baseline.points.length,
      whatIfResult.scenario_result.points.length
    );
    const data = [];
    for (let i = 0; i < maxLen; i++) {
      const basePt = whatIfResult.baseline.points[i];
      const scenPt = whatIfResult.scenario_result.points[i];
      const min = basePt?.minute ?? scenPt?.minute ?? i * 5;
      data.push({
        minute: `${min}m`,
        baseline: basePt?.temperature ?? null,
        scenario: scenPt?.temperature ?? null,
        upperLimit: whatIfResult.limits.upper,
        lowerLimit: whatIfResult.limits.lower,
      });
    }
    return data;
  }, [whatIfResult]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const apiEvents = facilityEventsPoll.data ?? [];
    if (timelineSeverityFilter === "all") return apiEvents;
    return apiEvents.filter((e) => e.severity === timelineSeverityFilter);
  }, [facilityEventsPoll.data, timelineSeverityFilter]);

  const hasAnyAlert =
    !simState.compressorRunning ||
    simState.failedSensors.size > 0 ||
    simState.burnedSensors.size > 0 ||
    simState.doorOpen ||
    simState.isRecovering;

  // Active Critical Incidents Count
  const activeCriticalCount = useMemo(() => {
    const alertsCount = alertsPoll.data?.filter((a) => a.severity === "critical" && a.active).length ?? 0;
    let count = alertsCount;
    if (!simState.compressorRunning) count++;
    if (simState.doorOpen && doorOpenSeconds > 180) count++;
    if (simState.burnedSensors.size > 0) count++;
    return count;
  }, [alertsPoll.data, simState, doorOpenSeconds]);

  // Normal vs At Risk Zones
  const zoneHealthCounts = useMemo(() => {
    const total = 3;
    let atRisk = 0;
    allZones.forEach((z) => {
      if (z.risk_category === "high" || z.risk_category === "medium") atRisk++;
    });
    if (simState.doorOpen || !simState.compressorRunning || simState.burnedSensors.size > 0) {
      atRisk = Math.max(atRisk, 1);
    }
    return {
      total,
      normal: Math.max(0, total - atRisk),
      atRisk,
    };
  }, [allZones, simState]);

  return (
    <div className="space-y-4 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* ═══════════════════════════════════════════════════════════════════
          FACILITY HEADER BAR (MATCHING REFERENCE IMAGE)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1424]/95 px-4 py-3 shadow-2xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand / Facility Context */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-inner">
              <Snowflake size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="text-base font-bold text-white tracking-wide leading-none">ColdGuard</div>
              <div className="text-[10px] text-cyan-400/80 font-mono mt-0.5">Digital Twin | Cold Storage Monitoring</div>
            </div>
          </div>

          {/* Facility Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs font-mono text-slate-200">
            <Warehouse size={14} className="text-cyan-400" />
            <span className="font-semibold">Facility: Nashik Cold Storage - Unit 1</span>
            <ChevronDown size={14} className="text-slate-400 ml-1" />
          </div>

          {/* Operational Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981] animate-pulse" />
            <span>Operational</span>
          </div>

          {/* Clock / Last Updated */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono hidden md:flex">
            <Clock size={14} className="text-slate-400" />
            <span>Last updated {new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })} • {liveClock}</span>
          </div>
        </div>

        {/* Right: Actions & Controls */}
        <div className="flex items-center gap-2.5 ml-auto flex-wrap">
          {/* Fault Injection Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 hover:bg-amber-950/70 hover:text-white text-xs font-mono font-semibold transition cursor-pointer shadow-lg">
              <Zap size={14} className="text-amber-400" />
              <span>Fault Injection</span>
              <ChevronDown size={14} className="text-amber-400/80" />
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-slate-950 border border-white/10 p-1.5 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 space-y-1">
              <button
                onClick={handleToggleDoor}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-amber-300 hover:bg-amber-950/60 flex items-center gap-2 cursor-pointer"
              >
                <DoorOpen size={13} />
                <span>Ingress (+26°C)</span>
              </button>
              <button
                onClick={handleToggleCompressor}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-rose-300 hover:bg-rose-950/60 flex items-center gap-2 cursor-pointer"
              >
                <PowerOff size={13} />
                <span>Trip Compressor</span>
              </button>
              <button
                onClick={handleBurnSensor}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-red-300 hover:bg-red-950/60 flex items-center gap-2 cursor-pointer"
              >
                <Flame size={13} />
                <span>Burn TS-A1 Probe</span>
              </button>
              <button
                onClick={handleDegradeCooling}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-cyan-300 hover:bg-cyan-950/60 flex items-center gap-2 cursor-pointer"
              >
                <ThermometerSnowflake size={13} />
                <span>Degrade (45%)</span>
              </button>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          {/* Notification Bell with Badge */}
          <div className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer">
            <Bell size={16} />
            {activeCriticalCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[10px] font-bold font-mono flex items-center justify-center shadow-[0_0_8px_#EF4444]">
                {activeCriticalCount}
              </span>
            )}
          </div>

          {/* User Profile Avatar */}
          <div className="h-8 w-8 rounded-xl bg-blue-600 text-white font-mono text-xs font-bold flex items-center justify-center border border-blue-400 shadow-md">
            RU
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          UPPER SECTION: 3D FACILITY VIEW (LEFT) + TELEMETRY & OPERATIONS (RIGHT)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* LEFT (col-span-8): 3D FACILITY VIEW */}
        <div className={is3DExpanded ? "xl:col-span-12" : "xl:col-span-8"}>
          <div className="rounded-2xl border border-white/10 bg-[#0B1424]/95 shadow-2xl overflow-hidden flex flex-col justify-between">
            {/* Header: Title + 3D View / Top View / Labels Switch */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-slate-900/90 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40">
                  <Boxes size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">3D Facility View</h2>
                  <div className="text-[10px] text-slate-400 font-mono">Interactive digital twin of cold storage</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCameraPreset("isometric")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                    cameraPreset !== "top"
                      ? "bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30"
                      : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                  }`}
                >
                  <Boxes size={13} />
                  <span>3D View</span>
                </button>

                <button
                  onClick={() => setCameraPreset("top")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                    cameraPreset === "top"
                      ? "bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30"
                      : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                  }`}
                >
                  <Layers size={13} />
                  <span>Top View</span>
                </button>

                <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
                  <span className="text-xs text-slate-400 font-mono">Labels</span>
                  <button
                    onClick={() => setShowLabels(!showLabels)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                      showLabels ? "bg-cyan-500" : "bg-slate-800"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full bg-white transition-transform ${
                        showLabels ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-bar: Camera Flight Navigation + View Mode Controls */}
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-white/10 bg-slate-950/70 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold flex items-center gap-1 mr-1">
                  <Navigation size={12} className="animate-pulse" /> CAMERA FLIGHT:
                </span>

                <button
                  onClick={() => {
                    setIsNavigating(false);
                    setCameraPreset("isometric");
                  }}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-all cursor-pointer ${
                    cameraPreset === "isometric" && !isNavigating
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  🌐 Overview
                </button>

                {ZONE_CONFIGS.map((cfg) => {
                  const isActive = selectedZoneId === cfg.id;
                  return (
                    <button
                      key={`flight-${cfg.id}`}
                      onClick={() => handleZoneSelect(cfg.id)}
                      className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold shadow-sm"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-cyan-400"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span>{cfg.name}</span>
                      <span className="text-[9px] text-cyan-400 font-bold">
                        {cfg.id === "zone-a" ? "16m" : cfg.id === "zone-b" ? "10m" : "8m"}
                      </span>
                    </button>
                  );
                })}

                <button
                  onClick={() => handleToggleDoor()}
                  className="px-2.5 py-1 text-[11px] font-mono rounded-lg border bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-amber-400 cursor-pointer flex items-center gap-1.5"
                >
                  <DoorOpen size={12} className="text-amber-400" />
                  <span>Loading Bay</span>
                  <span className="text-[9px] text-amber-400 font-bold">0m</span>
                </button>
              </div>

              {/* Action Toggles */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => setViewMode(viewMode === "thermal" ? "standard" : "thermal")}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border flex items-center gap-1 cursor-pointer transition ${
                    viewMode === "thermal"
                      ? "bg-amber-500/20 text-amber-300 border-amber-400 font-bold"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                  title="Thermal Heatmap"
                >
                  <Thermometer size={11} /> Thermal
                </button>

                <button
                  onClick={() => setViewMode(viewMode === "airflow" ? "standard" : "airflow")}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border flex items-center gap-1 cursor-pointer transition ${
                    viewMode === "airflow"
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                  title="Airflow Vectors"
                >
                  <Wind size={11} /> Airflow
                </button>

                <button
                  onClick={() => setShowLabels(!showLabels)}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border flex items-center gap-1 cursor-pointer transition ${
                    showLabels ? "bg-cyan-500/20 text-cyan-300 border-cyan-400" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Tag size={11} /> Labels
                </button>

                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border flex items-center gap-1 cursor-pointer transition ${
                    autoRotate ? "bg-purple-500/20 text-purple-300 border-purple-400 font-bold" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <RefreshCw size={11} className={autoRotate ? "animate-spin" : ""} /> Orbit
                </button>

                <button
                  onClick={() => setIs3DExpanded(!is3DExpanded)}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border flex items-center gap-1 cursor-pointer transition ${
                    is3DExpanded ? "bg-cyan-500/20 text-cyan-300 border-cyan-400" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {is3DExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                  <span>{is3DExpanded ? "Side View" : "Maximize View"}</span>
                </button>
              </div>
            </div>

            {/* 3D Canvas Viewport */}
            <div className="relative" style={{ height: is3DExpanded ? "740px" : "610px" }}>
              <Canvas shadows gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
                <Suspense fallback={null}>
                  <color attach="background" args={["#060d17"]} />
                  <fog attach="fog" args={["#060d17", 18, 42]} />
                  <ColdStorageScene
                    zones={allZones.length > 0 ? allZones : zones ?? []}
                    selectedZoneId={selectedZoneId}
                    onSelectZone={handleZoneSelect}
                    simulationState={simState}
                    cameraPreset={cameraPreset}
                    viewMode={viewMode}
                    showLabels={showLabels}
                    showCoverage={showCoverage}
                    autoRotate={autoRotate}
                    userInteracting={userInteracting}
                    setUserInteracting={setUserInteracting}
                    onToggleDoor={handleToggleDoor}
                    onHeadingChange={setCompassHeading}
                    onNavigationProgress={handleNavigationProgress}
                    isNavigating={isNavigating}
                    controlsRef={controlsRef}
                  />
                </Suspense>
              </Canvas>

              {/* Bottom-Left Sensor Legend (Matching Reference Image) */}
              <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
                <div className="rounded-xl border border-white/10 bg-slate-950/85 px-3 py-2 text-[11px] font-mono backdrop-blur-md shadow-xl flex flex-col gap-1 text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                    <span>Temperature Sensor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span>Humidity Sensor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                    <span>Airflow Sensor</span>
                  </div>
                </div>
              </div>

              {/* Floating Camera Controls on Right */}
              <div className="absolute top-4 right-3 z-30 flex flex-col items-center gap-1.5 pointer-events-auto">
                <button
                  onClick={() => setCameraPreset("isometric")}
                  className="w-8 h-8 rounded-lg bg-slate-900/90 border border-white/20 text-white flex items-center justify-center hover:bg-slate-800 transition-all shadow-xl cursor-pointer"
                  title="Reset Camera View"
                >
                  <Home size={15} className="text-cyan-400" />
                </button>

                <button
                  onClick={() => handleZoom(1)}
                  className="w-8 h-8 rounded-t-lg bg-slate-900/90 border border-white/20 text-white flex items-center justify-center hover:bg-slate-800 transition-all shadow-xl cursor-pointer mt-1"
                  title="Zoom In"
                >
                  <Plus size={15} />
                </button>

                <button
                  onClick={() => handleZoom(-1)}
                  className="w-8 h-8 rounded-b-lg bg-slate-900/90 border-x border-b border-white/20 text-white flex items-center justify-center hover:bg-slate-800 transition-all shadow-xl cursor-pointer"
                  title="Zoom Out"
                >
                  <Minus size={15} />
                </button>

                <button
                  onClick={handleResetNorth}
                  className="w-8 h-8 rounded-lg bg-slate-900/90 border border-white/20 text-white flex items-center justify-center hover:bg-slate-800 transition-all shadow-xl cursor-pointer mt-1"
                  title="Reset Orientation"
                >
                  <RotateCw size={15} className="text-cyan-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT (col-span-4): ZONE TELEMETRY & OPERATIONS CARD */}
        <div className={is3DExpanded ? "xl:col-span-12" : "xl:col-span-4"}>
          <div className="rounded-2xl border border-white/10 bg-[#0B1424]/95 p-4 shadow-2xl backdrop-blur-xl flex flex-col justify-between h-full space-y-4">
            {/* Header: Zone Title + Status Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers size={17} className="text-cyan-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  {selectedConfig.name} – Telemetry & Operations
                </h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  simState.doorOpen
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                    : simState.isRecovering
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {simState.doorOpen ? "● OPEN – INGRESS" : simState.isRecovering ? "● CLOSED – RECOVERING" : "● CLOSED – NORMAL"}
              </span>
            </div>

            {/* 8 Metric Tiles Grid (2 cols x 4 rows) */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Tile 1: Temperature */}
              <div className="rounded-xl border border-white/5 bg-slate-900/80 p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Thermometer size={14} className="text-cyan-400" />
                    <span>Temperature</span>
                  </div>
                  {/* Mini Sparkline */}
                  <svg width="40" height="14" className="overflow-visible">
                    <path d="M 0 10 L 8 8 L 16 9 L 24 5 L 32 7 L 40 4" fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {fmtTemp(currentZoneTemp)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Target: {selectedConfig.tempRange}
                </div>
              </div>

              {/* Tile 2: Relative Humidity */}
              <div className="rounded-xl border border-white/5 bg-slate-900/80 p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Droplets size={14} className="text-blue-400" />
                    <span>Relative Humidity</span>
                  </div>
                  <svg width="40" height="14" className="overflow-visible">
                    <path d="M 0 6 L 8 9 L 16 7 L 24 10 L 32 6 L 40 5" fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {selectedZone?.humidity != null ? `${Math.round(selectedZone.humidity)}%` : "53%"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Target: 45% – 70%
                </div>
              </div>

              {/* Tile 3: Power Load */}
              <div className="rounded-xl border border-white/5 bg-slate-900/80 p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Zap size={14} className="text-amber-400" />
                    <span>Power Load</span>
                  </div>
                  <svg width="40" height="14" className="overflow-visible">
                    <path d="M 0 8 L 10 5 L 20 9 L 30 6 L 40 5" fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {(selectedZone?.power_consumption_kw ?? 1.5).toFixed(1)} kW
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Load: {Math.round(selectedZone?.compressor_load_pct ?? 39)}% · Compressor: {simState.compressorRunning ? "ON" : "OFF"}
                </div>
              </div>

              {/* Tile 4: Sensor Probes */}
              <div className="rounded-xl border border-white/5 bg-slate-900/80 p-3 flex flex-col justify-between">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Radio size={14} className="text-emerald-400" />
                  <span>Sensor Probes</span>
                </div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
                  <span>2 / 2</span>
                  <span className="text-xs text-white">Online</span>
                  <CheckCircle2 size={14} className="text-emerald-400" />
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  All sensors healthy
                </div>
              </div>

              {/* Tile 5: Residual Rise ΔT */}
              <div className="rounded-xl border border-white/5 bg-slate-900/80 p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Wind size={14} className="text-cyan-400" />
                    <span>Residual Rise ΔT</span>
                  </div>
                  <svg width="40" height="14" className="overflow-visible">
                    <path d="M 0 10 L 10 9 L 20 10 L 30 8 L 40 7" fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-xl font-bold font-mono text-amber-300 mt-1">
                  +{(selectedZone?.residual_rise_predicted ?? simState.residualRise ?? 0).toFixed(1)}°C
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Accumulated warm air
                </div>
              </div>

              {/* Tile 6: Predicted Peak Temp */}
              <div className="rounded-xl border border-white/5 bg-slate-900/80 p-3 flex flex-col justify-between">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Thermometer size={14} className="text-rose-400" />
                  <span>Predicted Peak Temp</span>
                </div>
                <div className="text-xl font-bold font-mono text-rose-300 mt-1">
                  {selectedZone?.peak_temp_predicted != null
                    ? fmtTemp(selectedZone.peak_temp_predicted)
                    : fmtTemp(currentZoneTemp)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Thermal inertia peak
                </div>
              </div>

              {/* Tile 7: Est. Recovery Duration */}
              <div className="rounded-xl border border-white/5 bg-slate-900/80 p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock size={14} className="text-cyan-400" />
                    <span>Est. Recovery Duration</span>
                  </div>
                  <svg width="40" height="14" className="overflow-visible">
                    <path d="M 0 10 L 10 9 L 20 8 L 30 7 L 40 6" fill="none" stroke="#A855F7" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
                  ~ {Math.round(selectedZone?.recovery_time_minutes ?? simState.recoveryMinutes ?? 0)} min
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Post-incident cooling
                </div>
              </div>

              {/* Tile 8: 24h Ingress Time */}
              <div className="rounded-xl border border-white/5 bg-slate-900/80 p-3 flex flex-col justify-between">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Calendar size={14} className="text-blue-400" />
                  <span>24h Ingress Time</span>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {(selectedZone?.cumulative_open_minutes_24h ?? 0).toFixed(0)} min
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {selectedZone?.door_events_count_24h ?? 0} events recorded
                </div>
              </div>
            </div>

            {/* Cooling Recovery Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-medium">Cooling Recovery Progress</span>
                <span className="font-bold text-emerald-400">
                  {Math.round(selectedZone?.recovery_progress_pct ?? simState.recoveryProgressPct ?? 100)}%
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(5, selectedZone?.recovery_progress_pct ?? simState.recoveryProgressPct ?? 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* 3 Door Action Buttons Side-by-Side (Matching Reference Layout) */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => handleToggleDoor()}
                className="flex-1 py-2 px-3 rounded-xl border border-amber-500/50 bg-amber-950/40 hover:bg-amber-950/70 text-amber-300 text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
              >
                <DoorOpen size={14} className="text-amber-400" />
                <span>Open Door (2m)</span>
              </button>

              <button
                onClick={() => handleToggleDoor()}
                className="flex-1 py-2 px-3 rounded-xl border border-rose-500/50 bg-rose-950/40 hover:bg-rose-950/70 text-rose-300 text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
              >
                <DoorOpen size={14} className="text-rose-400" />
                <span>Open Door (5m)</span>
              </button>

              <button
                onClick={() => handleToggleDoor()}
                className="flex-1 py-2 px-3 rounded-xl border border-emerald-500/50 bg-emerald-950/50 hover:bg-emerald-900/70 text-emerald-300 text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Check size={14} />
                <span>Close Door</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          LOWER SECTION: TEMPERATURE FORECAST & ANALYTICS (FULL WIDTH)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1424]/95 p-5 shadow-2xl backdrop-blur-xl">
        {/* Header: Title + Center Tabs + Right Projection Mode */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <LineChartIcon size={18} className="text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Temperature Forecast & Analytics
            </h3>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 flex-wrap">
            {[
              { id: "forecast", label: "Forecast" },
              { id: "what-if", label: "What-If Simulator" },
              { id: "matrix", label: "Multi-Zone Matrix" },
              { id: "events", label: "Events & Recovery Log" },
              { id: "health", label: "Sensor Health" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveAnalyticsTab(tab.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                  activeAnalyticsTab === tab.id
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Projection Mode */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span className="text-slate-400">Projection Mode:</span>
            <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 flex items-center gap-1.5 font-semibold text-white">
              <span>Live AI Forecast (30 min)</span>
              <ChevronDown size={13} className="text-slate-400" />
            </div>
          </div>
        </div>

        {/* Tab 1: Primary Forecast View (Chart Left + AI Model Right) */}
        {activeAnalyticsTab === "forecast" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4">
            {/* Chart View (col-span-8) */}
            <div className="lg:col-span-8 space-y-3">
              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastData} margin={{ top: 20, right: 20, bottom: 5, left: -10 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="minute" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      domain={[0, 12]}
                      ticks={[0, 2, 4, 6, 8, 10, 12]}
                      label={{ value: "Temperature (°C)", angle: -90, position: "insideLeft", fill: "#64748B", fontSize: 10, dx: 15 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-2.5 text-xs font-mono shadow-2xl backdrop-blur-md">
                            <div className="text-slate-400 mb-1">{data.minute} ahead</div>
                            <div className="text-cyan-300 font-bold">Predicted: {data.temperature}°C</div>
                            <div className="text-slate-400 text-[10px]">Safe: 2°C – 8°C</div>
                          </div>
                        );
                      }}
                    />

                    {/* Red Dashed Upper Limit */}
                    <ReferenceLine
                      y={selectedConfig.upperLimit}
                      stroke="#EF4444"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Upper Limit (${selectedConfig.upperLimit}°C)`,
                        fill: "#EF4444",
                        fontSize: 10,
                        position: "insideTopLeft",
                      }}
                    />

                    {/* Blue Dashed Lower Limit */}
                    <ReferenceLine
                      y={selectedConfig.lowerLimit}
                      stroke="#3B82F6"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Lower Limit (${selectedConfig.lowerLimit}°C)`,
                        fill: "#3B82F6",
                        fontSize: 10,
                        position: "insideBottomLeft",
                      }}
                    />

                    {/* Confidence Range Area Shading */}
                    <Area
                      type="monotone"
                      dataKey="temperature"
                      fill="#22D3EE"
                      fillOpacity={0.15}
                      stroke="none"
                    />

                    {/* Cyan Predicted Temperature Line with Dots */}
                    <Line
                      type="monotone"
                      dataKey="temperature"
                      stroke="#22D3EE"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#22D3EE", stroke: "#0B1424", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "#FFFFFF", stroke: "#22D3EE", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend (Matching Reference Image) */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-300 font-mono pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-0.5 bg-cyan-400 rounded" />
                  <span>Predicted Temperature</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-3 rounded bg-cyan-400/20 border border-cyan-400/40" />
                  <span>Confidence Range</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 border-b-2 border-dashed border-red-500" />
                  <span className="text-red-400">Upper Limit ({selectedConfig.upperLimit}°C)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 border-b-2 border-dashed border-blue-500" />
                  <span className="text-blue-400">Lower Limit ({selectedConfig.lowerLimit}°C)</span>
                </div>
              </div>
            </div>

            {/* AI Model Card (col-span-4, Matching Reference Image) */}
            <div className="lg:col-span-4 rounded-xl border border-white/5 bg-slate-900/70 p-4 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">
                  <Cpu size={15} />
                  <span>AI Model</span>
                </div>
                <h4 className="text-base font-bold text-white tracking-tight">
                  Multi-Output Random Forest
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Predicts temperature, humidity and recovery time using 60 min physical thermal decay modeling.
                </p>
              </div>

              {/* 3 Metric Tiles in a Row */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {/* Predicted Peak Temp */}
                <div className="rounded-lg bg-slate-950/80 border border-white/5 p-2.5 flex flex-col justify-between">
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Thermometer size={12} className="text-cyan-400" />
                    <span>Predicted Peak</span>
                  </div>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    {selectedZone?.peak_temp_predicted != null ? fmtTemp(selectedZone.peak_temp_predicted) : fmtTemp(currentZoneTemp)}
                  </div>
                  <div className="mt-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Safe
                    </span>
                  </div>
                </div>

                {/* Time to Limit */}
                <div className="rounded-lg bg-slate-950/80 border border-white/5 p-2.5 flex flex-col justify-between">
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock size={12} className="text-amber-400" />
                    <span>Time to Limit</span>
                  </div>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    &gt; 60 min
                  </div>
                  <div className="mt-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Safe
                    </span>
                  </div>
                </div>

                {/* Model Confidence */}
                <div className="rounded-lg bg-slate-950/80 border border-white/5 p-2.5 flex flex-col justify-between">
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <TrendingUp size={12} className="text-purple-400" />
                    <span>Confidence</span>
                  </div>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    92%
                  </div>
                  <div className="mt-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      High
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: What-If Counterfactual Simulator */}
        {activeAnalyticsTab === "what-if" && (
          <div className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-300 font-semibold">Scenario:</span>
                <select
                  value={whatIfScenario}
                  onChange={(e) => setWhatIfScenario(e.target.value as any)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-cyan-300 cursor-pointer"
                >
                  <option value="door_open">Door Left Open (Air Ingress)</option>
                  <option value="compressor_failure">Compressor Failure (0 kW)</option>
                  <option value="cooling_degradation">Cooling Degradation (50%)</option>
                  <option value="abnormal_humidity">High Humidity Ingress</option>
                  <option value="fire_runaway">Fire / Thermal Runaway</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-300 font-semibold">Duration:</span>
                {[5, 10, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setWhatIfDuration(mins)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                      whatIfDuration === mins
                        ? "bg-cyan-600 text-white font-bold"
                        : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              <button
                onClick={handleRunWhatIf}
                disabled={whatIfLoading}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Play size={13} />
                <span>{whatIfLoading ? "Simulating..." : "Run Simulator"}</span>
              </button>
            </div>

            {/* Counterfactual Chart */}
            {whatIfResult && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={counterfactualChartData} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="minute" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip />
                    <ReferenceLine y={whatIfResult.limits.upper} stroke="#EF4444" strokeDasharray="4 4" />
                    <ReferenceLine y={whatIfResult.limits.lower} stroke="#3B82F6" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="baseline" stroke="#22D3EE" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="scenario" stroke="#F43F5E" strokeWidth={2.5} strokeDasharray="4 4" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Multi-Zone Matrix */}
        {activeAnalyticsTab === "matrix" && (
          <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {ZONE_CONFIGS.map((cfg) => {
              const zoneData = (zones as ZoneSummary[])?.find((z) => z.zone_id === cfg.id);
              const temp = zoneData?.temperature ?? cfg.targetTemp;
              const isSelected = selectedZoneId === cfg.id;
              return (
                <div
                  key={`matrix-${cfg.id}`}
                  onClick={() => handleZoneSelect(cfg.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected ? "bg-slate-900 border-cyan-400 shadow-lg" : "bg-slate-950/70 border-white/5 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">{cfg.name}</span>
                    <span className="text-[10px] font-mono text-cyan-400">{cfg.product}</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-white mb-2">{fmtTemp(temp)}</div>
                  <div className="text-xs text-slate-400 font-mono space-y-1">
                    <div>Safe Range: {cfg.tempRange}</div>
                    <div>Humidity: {zoneData?.humidity ? `${Math.round(zoneData.humidity)}%` : "50%"}</div>
                    <div>Power: {zoneData?.power_consumption_kw ? `${zoneData.power_consumption_kw.toFixed(1)} kW` : "1.5 kW"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 4: Events & Recovery Log */}
        {activeAnalyticsTab === "events" && (
          <div className="pt-4 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Zone</th>
                  <th className="pb-2">Event Description</th>
                  <th className="pb-2">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activityLog.map((ev, i) => (
                  <tr key={i} className="hover:bg-slate-900/40">
                    <td className="py-2.5 text-slate-400">{ev.time}</td>
                    <td className="py-2.5 text-white font-bold">{ev.zone}</td>
                    <td className="py-2.5 text-slate-200">{ev.message}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ev.type === "critical" ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" :
                        ev.type === "warning" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" :
                        "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      }`}>
                        {ev.type.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 5: Sensor Health */}
        {activeAnalyticsTab === "health" && (
          <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5">
              <span className="text-slate-400">Total Probes</span>
              <div className="text-lg font-bold text-white mt-1">6 Probes Installed</div>
              <div className="text-emerald-400 text-[10px] mt-0.5">100% Online</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5">
              <span className="text-slate-400">Telemetry Stream</span>
              <div className="text-lg font-bold text-cyan-300 mt-1">SSE / FastSync</div>
              <div className="text-slate-400 text-[10px] mt-0.5">Latency &lt; 50ms</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5">
              <span className="text-slate-400">Isolation Forest</span>
              <div className="text-lg font-bold text-emerald-400 mt-1">Nominal</div>
              <div className="text-slate-400 text-[10px] mt-0.5">Outlier Score: 0.04</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5">
              <span className="text-slate-400">Model Pipeline</span>
              <div className="text-lg font-bold text-purple-300 mt-1">RandomForest</div>
              <div className="text-slate-400 text-[10px] mt-0.5">Retrained 22 Features</div>
            </div>
          </div>
        )}
      </div>

      

      {/* ═══════════════════════════════════════════════════════════════════
          CONSEQUENTIAL ACTION SAFETY CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {confirmModal && confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-slate-950 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">{confirmModal.title}</h3>
                <div className="text-xs text-rose-300 font-mono">Consequential Simulation Event</div>
              </div>
            </div>

            <p className="text-xs text-fg leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="rounded-lg bg-rose-950/30 border border-rose-500/20 p-3 text-[11px] font-mono text-rose-200">
              <div className="font-bold text-rose-400 mb-1">Operational Impact:</div>
              {confirmModal.impact}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-fg-muted hover:text-white hover:bg-slate-900 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-1.5 rounded-lg border border-rose-500 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition shadow-lg cursor-pointer"
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
