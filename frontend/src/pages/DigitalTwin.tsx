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
  Database,
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
  Package,
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
import { CHART, fmtDoorDuration, fmtNum, fmtTemp, POLL_MS } from "../lib/format";
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
  ZonePredictionOverview,
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
  | "zone-c"
  | "plant-room"
  | "dock-bay";

export type ViewDisplayMode = "standard" | "thermal" | "airflow" | "blueprint";

export type SimulationScenario =
  | "normal"
  | "door_open"
  | "compressor_failure"
  | "sensor_anomaly"
  | "sensor_burn"
  | "fire_runaway"
  | "cooling_degradation"
  | "fan_off";

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
  "plant-room": { pos: [-11.2, 2.4, 4.5], target: [-8.8, 0.6, 2.2] },
  "dock-bay": { pos: [12.6, 2.8, 1.2], target: [10.1, 1.3, -1.8] },
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
      {isBurned && <ElectricalSparks position={[0, 0.1, 0]} />}
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

      {/* Tripped smoke and sparks when compressor fails */}
      {isFailed && <FireSmokeParticles position={[0, 0.8, 0]} />}
      {isFailed && <ElectricalSparks position={[0, 0.5, 0]} />}

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
                  {(() => {
                    const isProbeDegraded =
                      simulationState.burnedSensors.size > 0 ||
                      (zoneData?.sensor_health && zoneData.sensor_health !== "healthy");
                    return (
                      <div className={`flex items-center gap-1.5 ${isProbeDegraded ? "text-amber-400" : "text-emerald-400"}`}>
                        <Radio size={12} />
                        <span>{isProbeDegraded ? "1/2 Probes" : "2/2 Probes"}</span>
                      </div>
                    );
                  })()}
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
        isFailed={!simulationState.compressorRunning}
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
            <span className="font-bold text-white">{activeZone?.humidity != null ? `${activeZone.humidity.toFixed(0)}%` : "—"}</span>
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
   DYNAMIC SVG SPARKLINE COMPONENT (ZERO STATIC SVG STRINGS)
   ═══════════════════════════════════════════════════════════════════ */

function DynamicSparkline({
  data,
  color = "#22D3EE",
  width = 40,
  height = 14,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="overflow-visible">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth="1.5" strokeDasharray="2 2" opacity={0.4} />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.1;
  const padding = 2;
  const pts = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - padding - ((val - min) / range) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN DIGITAL TWIN PAGE EXPORT
   ═══════════════════════════════════════════════════════════════════ */

export default function DigitalTwin() {
  const {
    zones,
    selectedZone,
    selectedZoneId,
    setSelectedZoneId,
    zonesError,
    health,
    doorSimulations,
    isDoorOpen: isDoorOpenContext,
    getDoorOpenSeconds,
    toggleDoor,
  } = useApp();

  // Live shared zones from AppContext (SSE stream + fallback)
  const allZones = zones ?? [];

  const readings = usePolling(() => api.readings(selectedZoneId, 60), POLL_MS, [selectedZoneId]);
  const forecast = usePolling(() => api.forecast(selectedZoneId, 30), POLL_MS, [selectedZoneId]);
  const riskPoll = usePolling(() => api.risk(selectedZoneId, 30), POLL_MS, [selectedZoneId]);
  const alertsPoll = usePolling(() => api.alerts({ active: true, limit: 15 }), POLL_MS);
  const recoveryPoll = usePolling(() => api.recoveryStatus(selectedZoneId), POLL_MS, [selectedZoneId]);
  const doorEventsPoll = usePolling(() => api.doorEvents(selectedZoneId, 15), POLL_MS, [selectedZoneId]);
  const facilityEventsPoll = usePolling(() => api.events(25), POLL_MS, []);
  const predictionOverviewPoll = usePolling(() => api.predictionOverview(selectedZoneId, 30), POLL_MS, [selectedZoneId]);
  const modelEvaluationPoll = usePolling(() => api.modelEvaluation(), 30000);
  const telemetrySourcePoll = usePolling(() => api.getTelemetrySource(), 3000, []);

  // Live telemetry history arrays for dynamic sparklines
  const historyReadings = readings.data?.readings ?? [];
  const tempHistory = useMemo(
    () => historyReadings.map((r) => r.temperature).filter((v): v is number => typeof v === "number" && !isNaN(v)),
    [historyReadings]
  );
  const humidityHistory = useMemo(
    () => historyReadings.map((r) => r.humidity).filter((v): v is number => typeof v === "number" && !isNaN(v)),
    [historyReadings]
  );
  const powerHistory = useMemo(
    () => historyReadings.map((r) => r.power_consumption_kw ?? 0).filter((v): v is number => typeof v === "number" && !isNaN(v)),
    [historyReadings]
  );
  const residualHistory = useMemo(
    () => historyReadings.map((r) => r.residual_rise_predicted ?? 0).filter((v): v is number => typeof v === "number" && !isNaN(v)),
    [historyReadings]
  );
  const recoveryHistory = useMemo(
    () => historyReadings.map((r) => r.recovery_time_minutes ?? 0).filter((v): v is number => typeof v === "number" && !isNaN(v)),
    [historyReadings]
  );

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

  // Synchronized Simulation State (Directly driven by live backend telemetry and global AppContext)
  const [simState, setSimState] = useState({
    failedSensors: new Set<string>(),
    burnedSensors: new Set<string>(),
    accidentZones: new Set<string>(),
    fansActive: true,
    compressorRunning: true,
    doorOpen: isDoorOpenContext(selectedZoneId || "zone-a"),
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

  const [activeScenario, setActiveScenario] = useState<SimulationScenario>(() =>
    isDoorOpenContext(selectedZoneId || "zone-a") ? "door_open" : "normal"
  );
  // Shared precise elapsed door open seconds across entire application
  const doorOpenSeconds = getDoorOpenSeconds(selectedZoneId || "zone-a");
  const lastUserActionTime = useRef<number>(0);

  // Activity Log (Session events triggered by operators)
  const [activityLog, setActivityLog] = useState<SensorEvent[]>([]);

  const addEvent = useCallback((message: string, type: SensorEvent["type"], zone: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setActivityLog((prev) => [{ time, message, type, zone }, ...prev.slice(0, 9)]);
  }, []);

  // Sync DigitalTwin simState with the unified live backend stream (SSE / REST)
  useEffect(() => {
    if (allZones.length === 0) return;

    const zA = allZones.find((z) => z.zone_id === "zone-a");
    const zB = allZones.find((z) => z.zone_id === "zone-b");
    const zC = allZones.find((z) => z.zone_id === "zone-c");
    const activeZoneId = selectedZoneId || "zone-a";
    const curr = allZones.find((z) => z.zone_id === activeZoneId) || allZones[0];

    const isDoorOpen = isDoorOpenContext(activeZoneId) || curr?.scenario === "door_open" || curr?.door_status === "open";
    const isFireRunaway = curr?.scenario === "fire_runaway";
    const isCompFailed = curr?.scenario === "compressor_failure" || curr?.compressor_status === "failed";
    const isDegraded = curr?.scenario === "cooling_degradation";
    const isFanOff = curr?.scenario === "fan_off" || (curr as any)?.fans_active === false;
    const isSensorAnomaly = curr?.scenario === "sensor_anomaly";

    const isRecovering = (curr?.recovery_phase && curr.recovery_phase !== "none" && curr.recovery_phase !== "recovered") || (curr?.residual_rise_predicted ?? 0) > 0.05;

    const burnedProbes = new Set<string>();
    const failedProbes = new Set<string>();

    allZones.forEach((z) => {
      const sId = z.sensor_id || `${z.zone_id.replace("zone-", "TS-").toUpperCase()}1`;
      if (z.scenario === "fire_runaway") {
        burnedProbes.add(sId);
      } else if (z.scenario === "sensor_anomaly") {
        failedProbes.add(sId);
      }
    });

    const serverScenario: SimulationScenario = (curr?.scenario as SimulationScenario) || "normal";

    const isUserActionRecent = Date.now() - lastUserActionTime.current < 4000;

    if (!isUserActionRecent) {
      setActiveScenario(serverScenario === "door_open" || isDoorOpen ? "door_open" : serverScenario);

      setSimState((prev) => ({
        ...prev,
        doorOpen: isDoorOpen,
        isRecovering,
        recoveryProgressPct: curr?.recovery_progress_pct ?? 100,
        residualRise: curr?.residual_rise_predicted ?? 0,
        peakTemp: curr?.peak_temp_predicted ?? null,
        recoveryMinutes: curr?.recovery_time_minutes ?? 0,
        compressorRunning: !isCompFailed && !isFireRunaway,
        fansActive: !isCompFailed && !isFireRunaway && !isFanOff,
        burnedSensors: isFireRunaway ? (burnedProbes.size > 0 ? burnedProbes : new Set([curr?.sensor_id || "TS-A01"])) : new Set(),
        failedSensors: isSensorAnomaly ? (failedProbes.size > 0 ? failedProbes : new Set([curr?.sensor_id || "TS-A01"])) : new Set(),
        zoneTemps: {
          "zone-a": zA?.temperature ?? 5.0,
          "zone-b": zB?.temperature ?? 3.0,
          "zone-c": zC?.temperature ?? -20.0,
        },
      }));
    } else {
      // Just update temperature readings without wiping out user's active fault simulation
      setSimState((prev) => ({
        ...prev,
        zoneTemps: {
          "zone-a": zA?.temperature ?? 5.0,
          "zone-b": zB?.temperature ?? 3.0,
          "zone-c": zC?.temperature ?? -20.0,
        },
      }));
    }
  }, [allZones, selectedZoneId, isDoorOpenContext]);

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

  // 1. Simulate Door Ingress (Door Left Open)
  const handleSimulateDoor = useCallback(
    async (durationMinutes?: number) => {
      lastUserActionTime.current = Date.now();
      const targetZoneId = selectedZoneId || "zone-a";
      const targetConfig = ZONE_CONFIGS.find((c) => c.id === targetZoneId);
      const isCurrentlyOpen = isDoorOpenContext(targetZoneId);
      const currentDuration = doorSimulations[targetZoneId]?.durationMinutes;

      let willOpen: boolean;
      if (durationMinutes !== undefined) {
        willOpen = !(isCurrentlyOpen && currentDuration === durationMinutes);
      } else {
        willOpen = !isCurrentlyOpen;
      }

      if (willOpen) {
        setActiveScenario("door_open");
        setSimState((prev) => ({
          ...prev,
          doorOpen: true,
          isRecovering: false,
        }));
        setCameraPreset("dock-bay");
        addEvent(
          `🚪 ${targetConfig?.name ?? targetZoneId} DOOR LEFT OPEN (${durationMinutes ? `${durationMinutes}m` : "Continuous Ingress"}): Warm air plume entering chamber`,
          "warning",
          targetConfig?.name ?? "Dock"
        );
      } else {
        setActiveScenario("normal");
        setSimState((prev) => ({
          ...prev,
          doorOpen: false,
          isRecovering: true,
        }));
        addEvent(
          `✓ ${targetConfig?.name ?? targetZoneId} door sealed; post-closure cooling recovery initiated (thermal inertia monitored)`,
          "info",
          targetConfig?.name ?? "Dock"
        );
      }
      await toggleDoor(targetZoneId, durationMinutes);
    },
    [selectedZoneId, isDoorOpenContext, doorSimulations, addEvent, toggleDoor]
  );

  const handleToggleDoor = useCallback(() => handleSimulateDoor(), [handleSimulateDoor]);

  // 2. Simulate Compressor Trip
  const handleToggleCompressor = useCallback(async () => {
    lastUserActionTime.current = Date.now();
    const targetZoneId = selectedZoneId || "zone-a";
    const isRunning = simState.compressorRunning && activeScenario !== "compressor_failure";

    if (isRunning) {
      setActiveScenario("compressor_failure");
      setSimState((prev) => ({ ...prev, compressorRunning: false, fansActive: false }));
      addEvent("⚠️ PRIMARY COMPRESSOR RACK TRIPPED: Facility cooling lost & fans halted", "critical", "Compressor");
      setCameraPreset("plant-room");
      try {
        await api.setScenario(targetZoneId, "compressor_failure").catch(() => {});
      } catch (err) {
        console.error("Failed to trip compressor:", err);
      }
    } else {
      setActiveScenario("normal");
      setSimState((prev) => ({ ...prev, compressorRunning: true, fansActive: true }));
      addEvent("✓ Compressor rack restored; active refrigeration online", "info", "Compressor");
      try {
        await api.reset("scenario", targetZoneId).catch(() => {});
      } catch (err) {
        console.error("Failed to restore compressor:", err);
      }
    }
  }, [selectedZoneId, simState.compressorRunning, activeScenario, addEvent]);

  // 2b. Simulate Evaporator Cooling Fan Trip / Offline
  const handleToggleFan = useCallback(async () => {
    lastUserActionTime.current = Date.now();
    const targetZoneId = selectedZoneId || "zone-a";
    const isFanRunning = simState.fansActive && activeScenario !== "fan_off";

    if (isFanRunning) {
      setActiveScenario("fan_off");
      setSimState((prev) => ({ ...prev, fansActive: false }));
      addEvent(`⚠️ EVAPORATOR COOLING FAN TRIPPED in ${targetZoneId}: Forced air circulation halted, cooling extraction reduced by 85%`, "warning", "Evaporator Fan");
      try {
        await api.setScenario(targetZoneId, "fan_off").catch(() => {});
      } catch (err) {
        console.error("Failed to trip fan:", err);
      }
    } else {
      setActiveScenario("normal");
      setSimState((prev) => ({ ...prev, fansActive: true }));
      addEvent(`✓ Evaporator cooling fan in ${targetZoneId} restored to full airflow`, "info", "Evaporator Fan");
      try {
        await api.reset("scenario", targetZoneId).catch(() => {});
      } catch (err) {
        console.error("Failed to restore fan:", err);
      }
    }
  }, [selectedZoneId, simState.fansActive, activeScenario, addEvent]);

  // 3. Simulate Sensor Failure / Dropout / Anomaly
  const handleToggleSensorFailure = useCallback(async () => {
    lastUserActionTime.current = Date.now();
    const targetZoneId = selectedZoneId || "zone-a";
    const targetSensorId = `${targetZoneId.replace("zone-", "TS-").toUpperCase()}1`;
    const isCurrentlyFailed = simState.failedSensors.has(targetSensorId) || activeScenario === "sensor_anomaly";

    if (!isCurrentlyFailed) {
      setSimState((prev) => {
        const next = new Set(prev.failedSensors);
        next.add(targetSensorId);
        return { ...prev, failedSensors: next };
      });
      setActiveScenario("sensor_anomaly");
      addEvent(`⚠️ SENSOR FAILURE INJECTED: Probe ${targetSensorId} dropout & telemetry corrupted`, "warning", targetZoneId);
      setCameraPreset(targetZoneId as CameraPreset);
      try {
        await api.setScenario(targetZoneId, "sensor_anomaly").catch(() => {});
      } catch (err) {
        console.error("Failed to inject sensor failure:", err);
      }
    } else {
      setSimState((prev) => {
        const next = new Set(prev.failedSensors);
        next.delete(targetSensorId);
        return { ...prev, failedSensors: next };
      });
      setActiveScenario("normal");
      addEvent(`✓ Sensor ${targetSensorId} recalibrated & restored to normal`, "info", targetZoneId);
      try {
        await api.reset("scenario", targetZoneId).catch(() => {});
      } catch (err) {
        console.error("Failed to reset sensor failure:", err);
      }
    }
  }, [selectedZoneId, simState.failedSensors, activeScenario, addEvent]);

  // 4. Simulate Sensor Burning / Fire / Thermal Runaway
  const handleToggleSensorBurning = useCallback(async () => {
    lastUserActionTime.current = Date.now();
    const targetZoneId = selectedZoneId || "zone-a";
    const targetSensorId = `${targetZoneId.replace("zone-", "TS-").toUpperCase()}1`;
    const isCurrentlyBurned =
      simState.burnedSensors.has(targetSensorId) ||
      activeScenario === "fire_runaway" ||
      activeScenario === "sensor_burn";

    if (!isCurrentlyBurned) {
      setSimState((prev) => {
        const nextBurned = new Set(prev.burnedSensors);
        nextBurned.add(targetSensorId);
        return { ...prev, burnedSensors: nextBurned, compressorRunning: false, fansActive: false };
      });
      setActiveScenario("fire_runaway");
      addEvent(`🔥 SENSOR BURNING & THERMAL RUNAWAY: Probe ${targetSensorId} flaming! Compressor failsafe triggered`, "critical", targetZoneId);
      setCameraPreset(targetZoneId as CameraPreset);
      try {
        await api.setScenario(targetZoneId, "fire_runaway").catch(() => {});
      } catch (err) {
        console.error("Failed to inject fire runaway:", err);
      }
    } else {
      setSimState((prev) => {
        const nextBurned = new Set(prev.burnedSensors);
        nextBurned.delete(targetSensorId);
        return { ...prev, burnedSensors: nextBurned, compressorRunning: true, fansActive: true };
      });
      setActiveScenario("normal");
      addEvent(`✓ Fire extinguished; sensor probe ${targetSensorId} replaced`, "info", targetZoneId);
      try {
        await api.reset("scenario", targetZoneId).catch(() => {});
      } catch (err) {
        console.error("Failed to reset fire runaway:", err);
      }
    }
  }, [selectedZoneId, simState.burnedSensors, activeScenario, addEvent]);

  // 5. Simulate Cooling Capacity Degradation (45% loss)
  const handleToggleDegradation = useCallback(async () => {
    lastUserActionTime.current = Date.now();
    const targetZoneId = selectedZoneId || "zone-a";
    const isCurrentlyDegraded = activeScenario === "cooling_degradation";

    if (!isCurrentlyDegraded) {
      setActiveScenario("cooling_degradation");
      addEvent("📉 COOLING DEGRADATION INJECTED: 45% capacity loss & compressor strain", "warning", targetZoneId);
      try {
        await api.setScenario(targetZoneId, "cooling_degradation").catch(() => {});
      } catch (err) {
        console.error("Failed to inject degradation:", err);
      }
    } else {
      setActiveScenario("normal");
      addEvent("✓ Cooling system restored to nominal 100% capacity", "info", targetZoneId);
      try {
        await api.reset("scenario", targetZoneId).catch(() => {});
      } catch (err) {
        console.error("Failed to reset degradation:", err);
      }
    }
  }, [selectedZoneId, activeScenario, addEvent]);

  // Legacy alias for degradation
  const handleDegradeCooling = handleToggleDegradation;
  const handleBurnSensor = handleToggleSensorBurning;

  // 6. Reset All Systems to Nominal Baseline
  const handleResetAll = useCallback(async () => {
    lastUserActionTime.current = 0;
    setActiveScenario("normal");
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
    addEvent("🔄 ALL SYSTEMS RESET: Baseline 100% nominal operation restored", "info", "System");
    try {
      await api.reset("full").catch(() => {});
      await api.reset("scenario").catch(() => {});
      await api.controlDoor("zone-a", "close").catch(() => {});
      await api.controlDoor("zone-b", "close").catch(() => {});
      await api.controlDoor("zone-c", "close").catch(() => {});
      const activeId = selectedZoneId || "zone-a";
      if (isDoorOpenContext(activeId)) {
        await toggleDoor(activeId, undefined, "close").catch(() => {});
      }
    } catch (err) {
      console.error("Failed to reset all systems:", err);
    }
  }, [addEvent, selectedZoneId, isDoorOpenContext, toggleDoor]);

  // Telemetry Source Switcher (Dataset Playback vs Live Simulation / Feeder)
  const handleToggleTelemetrySource = useCallback(
    async (targetSource: "dataset" | "simulator") => {
      try {
        await api.setTelemetrySource(targetSource);
        telemetrySourcePoll.refresh();
        addEvent(
          targetSource === "dataset"
            ? "✓ Switched to Dataset Playback: streaming real sensor rows from test_dataset.csv"
            : "✓ Switched to Live IoT Feeder & Physics Simulator",
          "info",
          "Telemetry"
        );
      } catch (err) {
        console.error("Failed to switch telemetry source:", err);
      }
    },
    [telemetrySourcePoll, addEvent]
  );

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
      const outdoorTemp = 27.0;
      const gradient = Math.max(1, Math.round(outdoorTemp - currentZoneTemp));
      // Ingress risk grows with time: 15 pts initially, scaling up to 45 pts as air curtain breaks down
      const doorTimeFactor = Math.min(1.0, Math.max(0.15, doorOpenSeconds / 180));
      const doorPts = Math.round(15 + 30 * doorTimeFactor);
      localScore += doorPts;
      localFactors.push({
        label: "Loading Door Ingress",
        detail: `Dock door open for ${fmtDoorDuration(doorOpenSeconds)} (${outdoorTemp.toFixed(1)}°C outdoor ambient, +${gradient}°C gradient). Thermal infiltration active.`,
        points: doorPts,
      });
    }

    if (!simState.fansActive || activeScenario === "fan_off") {
      localScore += 40;
      localFactors.push({
        label: "Evaporator Cooling Fan Tripped",
        detail: "Forced air circulation halted; 85% reduction in cooling extraction across coils.",
        points: 40,
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

    if (simState.burnedSensors.size > 0 || activeScenario === "fire_runaway" || activeScenario === "sensor_burn") {
      localScore += 65;
      localFactors.push({
        label: "Sensor Fire / Thermal Runaway",
        detail: `Critical thermal runaway on probe (${Array.from(simState.burnedSensors).join(", ") || "TS-A1"}); +2°C/min heat influx and failsafe active`,
        points: 65,
      });
    }

    if (simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly") {
      localScore += 35;
      localFactors.push({
        label: "Sensor Telemetry Dropout",
        detail: `Probe (${Array.from(simState.failedSensors).join(", ") || "TS-A1"}) corrupted / stuck frozen; Isolation Forest outlier score > 0.95`,
        points: 35,
      });
    }

    if (activeScenario === "cooling_degradation") {
      localScore += 30;
      localFactors.push({
        label: "Cooling Capacity Degradation",
        detail: "Condenser fouling / partial refrigerant loss; cooling efficiency derated by 45%",
        points: 30,
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
    } else if (simState.burnedSensors.size > 0 || activeScenario === "fire_runaway" || activeScenario === "sensor_burn") {
      recommendation = "CRITICAL FIRE ACTION: Extinguish sensor thermal runaway. Isolate 24V supply line, switch temperature control loop to redundant probe TS-A2.";
      actionLabel = "⚡ Extinguish Fire & Isolate Probe";
      onAction = handleToggleSensorBurning;
    } else if (simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly") {
      recommendation = "TELEMETRY ACTION: Sensor dropout / stuck reading detected. Switch HVAC loop to virtual ensemble fallback and recalibrate probe TS-A1.";
      actionLabel = "⚡ Reset Telemetry Stream";
      onAction = handleToggleSensorFailure;
    } else if (activeScenario === "cooling_degradation") {
      recommendation = "HVAC DEGRADATION ACTION: Condenser efficiency derated by 45%. Clear evaporator frost buildup, inspect expansion valve, restore 100% COP.";
      actionLabel = "⚡ Restore 100% Cooling COP";
      onAction = handleToggleDegradation;
    }

    return { score, category, factors, recommendation, actionLabel, onAction };
  }, [simState, doorOpenSeconds, currentZoneTemp, selectedConfig, selectedZoneId, selectedZone, riskPoll.data, activeScenario, handleToggleDoor, handleToggleCompressor, handleBurnSensor, handleToggleSensorBurning, handleToggleSensorFailure, handleToggleDegradation]);

  // Live Forecast Points (Dynamically projecting impact of active situations)
  const forecastData = useMemo(() => {
    if (
      forecast.data?.points?.length &&
      activeScenario === "normal" &&
      !simState.doorOpen &&
      simState.compressorRunning &&
      simState.burnedSensors.size === 0 &&
      simState.failedSensors.size === 0
    ) {
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
    const driftRate =
      activeScenario === "fire_runaway" || simState.burnedSensors.size > 0
        ? 1.55
        : simState.doorOpen
        ? (selectedZoneId === "zone-c" ? 1.05 : 0.82)
        : !simState.compressorRunning
        ? 0.62
        : activeScenario === "cooling_degradation"
        ? 0.38
        : 0.05;

    for (let min = 0; min <= 30; min += 5) {
      const anomalyNoise =
        activeScenario === "sensor_anomaly" && min > 0
          ? (min % 10 === 0 ? 5.2 : -2.8)
          : 0;

      const projected = Number((currentZoneTemp + (min / 5) * driftRate + anomalyNoise).toFixed(2));
      points.push({
        minute: `${min}m`,
        temperature: projected,
        upperLimit: selectedConfig.upperLimit,
        lowerLimit: selectedConfig.lowerLimit,
      });
    }
    return points;
  }, [currentZoneTemp, simState, activeScenario, selectedZoneId, selectedConfig, forecast.data]);

  // Dynamic Y-Axis Domain based on active zone limits & live forecast values
  const yDomain = useMemo(() => {
    const temps = forecastData.map((d) => d.temperature).filter((t) => typeof t === "number" && !isNaN(t));
    const minVal = Math.min(...temps, selectedConfig.lowerLimit);
    const maxVal = Math.max(...temps, selectedConfig.upperLimit);
    const padding = Math.max(1.5, (maxVal - minVal) * 0.15);
    return [Math.floor(minVal - padding), Math.ceil(maxVal + padding)];
  }, [forecastData, selectedConfig]);

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
    <div className="space-y-4 font-sans selection:bg-[#EFF6FF] selection:text-[#2563EB]">
      {/* ═══════════════════════════════════════════════════════════════════
          FACILITY HEADER BAR (MATCHING REFERENCE IMAGE)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white px-5 py-3.5 shadow-arctic-card flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand / Facility Context */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] shadow-sm">
              <Snowflake size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="text-base font-bold text-[#0F172A] tracking-tight leading-none">ColdGuard</div>
              <div className="text-[11px] text-[#475569] font-mono mt-0.5">Digital Twin | Cold Storage Monitoring</div>
            </div>
          </div>

          {/* Facility Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EFF6FF] border border-[#DCE8F6] text-xs font-mono text-[#0F172A]">
            <Warehouse size={14} className="text-[#2563EB]" />
            <span className="font-semibold text-[#0F172A]">Facility: ColdGuard Central Storage</span>
            <span className="text-[10px] text-[#475569] ml-1">({allZones.length} Zones Active)</span>
          </div>

          {/* Operational Status Badge */}
          {(() => {
            const isCritical = activeCriticalCount > 0 || !simState.compressorRunning;
            const isWarning = zoneHealthCounts.atRisk > 0 || simState.doorOpen || simState.isRecovering;
            return (
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold shadow-sm ${
                  isCritical
                    ? "bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]"
                    : isWarning
                    ? "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]"
                    : "bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full animate-pulse ${
                    isCritical
                      ? "bg-[#EF4444]"
                      : isWarning
                      ? "bg-[#F59E0B]"
                      : "bg-[#10B981]"
                  }`}
                />
                <span>{isCritical ? "Critical Alert" : isWarning ? "Risk Warning" : "Operational"}</span>
              </div>
            );
          })()}

          {/* Clock / Last Updated */}
          <div className="flex items-center gap-1.5 text-xs text-[#475569] font-mono hidden md:flex">
            <Clock size={14} className="text-[#475569]" />
            <span>Last updated {new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })} • {liveClock}</span>
          </div>
        </div>

        {/* Right: Actions & Controls */}
        <div className="flex items-center gap-2.5 ml-auto flex-wrap">
          {/* Fault Injection Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] hover:bg-[#FEF3C7] text-xs font-mono font-semibold transition cursor-pointer shadow-sm">
              <Zap size={14} className="text-[#F59E0B]" />
              <span>Fault Injection</span>
              <ChevronDown size={14} className="text-[#92400E]/80" />
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-white border border-[#DCE8F6] p-1.5 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 space-y-1">
              <button
                onClick={() => handleSimulateDoor()}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-[#92400E] hover:bg-[#FFFBEB] flex items-center gap-2 cursor-pointer transition"
              >
                <DoorOpen size={13} />
                <span>Door Left Open (+26°C)</span>
              </button>
              <button
                onClick={handleToggleCompressor}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-[#991B1B] hover:bg-[#FEF2F2] flex items-center gap-2 cursor-pointer transition"
              >
                <PowerOff size={13} />
                <span>Trip Compressor Rack</span>
              </button>
              <button
                onClick={handleToggleSensorFailure}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-[#6D28D9] hover:bg-[#F5F3FF] flex items-center gap-2 cursor-pointer transition"
              >
                <ZapOff size={13} />
                <span>Sensor Probe Failure</span>
              </button>
              <button
                onClick={handleToggleSensorBurning}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-[#991B1B] hover:bg-[#FEF2F2] flex items-center gap-2 cursor-pointer transition"
              >
                <Flame size={13} />
                <span>Sensor Burning (Fire/Smoke)</span>
              </button>
              <button
                onClick={handleToggleDegradation}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-[#2563EB] hover:bg-[#EFF6FF] flex items-center gap-2 cursor-pointer transition"
              >
                <ThermometerSnowflake size={13} />
                <span>Cooling Degradation (45%)</span>
              </button>
              <div className="border-t border-[#DCE8F6] my-1" />
              <button
                onClick={handleResetAll}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-[#475569] hover:bg-[#F1F7FF] hover:text-[#0F172A] flex items-center gap-2 cursor-pointer transition"
              >
                <RotateCcw size={13} className="text-[#2563EB]" />
                <span>Reset All Systems</span>
              </button>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#DCE8F6] text-xs font-mono text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F7FF] transition cursor-pointer shadow-sm"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          {/* Notification Bell with Badge */}
          <div className="relative p-2 rounded-xl bg-white border border-[#DCE8F6] text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F7FF] cursor-pointer shadow-sm transition">
            <Bell size={16} />
            {activeCriticalCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold font-mono flex items-center justify-center shadow-sm">
                {activeCriticalCount}
              </span>
            )}
          </div>

          {/* Operator Console */}
          <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] flex items-center justify-center shadow-sm" title="Operator Console">
            <Eye size={15} />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          UPPER SECTION: 3D FACILITY VIEW (LEFT) + TELEMETRY & OPERATIONS (RIGHT)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* LEFT (col-span-8): 3D FACILITY VIEW */}
        <div className={is3DExpanded ? "xl:col-span-12" : "xl:col-span-8"}>
          <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden flex flex-col justify-between">
            {/* Header: Title + 3D View / Top View / Labels Switch */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#DCE8F6] bg-[#F8FAFC] flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BFDBFE]">
                  <Boxes size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A] tracking-tight">3D Facility View</h2>
                  <div className="text-[10px] text-[#475569] font-mono">Interactive digital twin of cold storage</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCameraPreset("isometric")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                    cameraPreset !== "top"
                      ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                      : "bg-white text-[#475569] border-[#DCE8F6] hover:text-[#0F172A] hover:bg-[#F1F7FF]"
                  }`}
                >
                  <Boxes size={13} />
                  <span>3D View</span>
                </button>

                <button
                  onClick={() => setCameraPreset("top")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                    cameraPreset === "top"
                      ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                      : "bg-white text-[#475569] border-[#DCE8F6] hover:text-[#0F172A] hover:bg-[#F1F7FF]"
                  }`}
                >
                  <Layers size={13} />
                  <span>Top View</span>
                </button>

                <div className="flex items-center gap-1.5 pl-2 border-l border-[#DCE8F6]">
                  <span className="text-xs text-[#475569] font-mono">Labels</span>
                  <button
                    onClick={() => setShowLabels(!showLabels)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                      showLabels ? "bg-[#2563EB]" : "bg-slate-300"
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
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[#DCE8F6] bg-[#F1F7FF] flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-[#2563EB] uppercase font-bold flex items-center gap-1 mr-1">
                  <Navigation size={12} className="animate-pulse" /> CAMERA FLIGHT:
                </span>

                <button
                  onClick={() => {
                    setIsNavigating(false);
                    setCameraPreset("isometric");
                  }}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-all cursor-pointer ${
                    cameraPreset === "isometric" && !isNavigating
                      ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] font-bold shadow-sm"
                      : "bg-white text-[#475569] border-[#DCE8F6] hover:text-[#0F172A] hover:bg-[#EFF6FF]"
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
                          ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] font-bold shadow-sm"
                          : "bg-white text-[#475569] border-[#DCE8F6] hover:text-[#0F172A] hover:border-[#BFDBFE]"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span>{cfg.name}</span>
                      <span className="text-[9px] text-[#2563EB] font-bold">
                        {cfg.id === "zone-a" ? "16m" : cfg.id === "zone-b" ? "10m" : "8m"}
                      </span>
                    </button>
                  );
                })}

                <button
                  onClick={() => setCameraPreset("plant-room")}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                    cameraPreset === "plant-room"
                      ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] font-bold shadow-sm"
                      : "bg-white text-[#475569] border-[#DCE8F6] hover:text-[#0F172A] hover:border-[#BFDBFE]"
                  }`}
                  title="Fly to Plant Room / Compressor Rack"
                >
                  <Cpu size={12} className="text-[#2563EB]" />
                  <span>Plant Room</span>
                </button>

                <button
                  onClick={() => setCameraPreset("dock-bay")}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                    cameraPreset === "dock-bay"
                      ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] font-bold shadow-sm"
                      : "bg-white text-[#475569] border-[#DCE8F6] hover:text-[#0F172A] hover:border-[#BFDBFE]"
                  }`}
                  title="Fly to Loading Dock & Door Ingress"
                >
                  <DoorOpen size={12} className="text-[#F59E0B]" />
                  <span>Loading Dock</span>
                </button>
              </div>

              {/* Action Toggles */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => setViewMode(viewMode === "thermal" ? "standard" : "thermal")}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border flex items-center gap-1 cursor-pointer transition ${
                    viewMode === "thermal"
                      ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] font-bold shadow-sm"
                      : "bg-white text-[#475569] border-[#DCE8F6] hover:text-[#0F172A]"
                  }`}
                  title="Thermal Heatmap"
                >
                  <Thermometer size={11} /> Thermal
                </button>

                <button
                  onClick={() => setViewMode(viewMode === "airflow" ? "standard" : "airflow")}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border flex items-center gap-1 cursor-pointer transition ${
                    viewMode === "airflow"
                      ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] font-bold shadow-sm"
                      : "bg-white text-[#475569] border-[#DCE8F6] hover:text-[#0F172A]"
                  }`}
                  title="Airflow Vectors"
                >
                  <Wind size={11} /> Airflow
                </button>

                <button
                  onClick={() => setShowLabels(!showLabels)}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border flex items-center gap-1 cursor-pointer transition ${
                    showLabels ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] font-bold" : "bg-white text-[#475569] border-[#DCE8F6] hover:text-[#0F172A]"
                  }`}
                >
                  <Tag size={11} /> Labels
                </button>

                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border flex items-center gap-1 cursor-pointer transition ${
                    autoRotate ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] font-bold" : "bg-white text-[#475569] border-[#DCE8F6] hover:text-[#0F172A]"
                  }`}
                >
                  <RefreshCw size={11} className={autoRotate ? "animate-spin" : ""} /> Orbit
                </button>

                <button
                  onClick={() => setIs3DExpanded(!is3DExpanded)}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border flex items-center gap-1 cursor-pointer transition ${
                    is3DExpanded ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] font-bold" : "bg-white text-[#475569] border-[#DCE8F6] hover:text-[#0F172A]"
                  }`}
                >
                  {is3DExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                  <span>{is3DExpanded ? "Side View" : "Maximize View"}</span>
                </button>
              </div>
            </div>

            {/* Direct Simulation & Fault Injection Control Dock */}
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[#DCE8F6] bg-white flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono text-[#F59E0B] uppercase font-bold flex items-center gap-1.5 mr-1">
                  <Zap size={13} className="text-[#F59E0B] animate-pulse" /> SIMULATION LAB:
                </span>

                {/* 1. Door Left Open */}
                <div className="flex items-center rounded-lg border border-[#FDE68A] bg-[#FFFBEB] overflow-hidden">
                  <button
                    onClick={() => handleSimulateDoor()}
                    className={`px-2.5 py-1 text-[11px] font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      simState.doorOpen || isDoorOpenContext(selectedZoneId || "zone-a")
                        ? "bg-[#F59E0B] text-white font-bold shadow-sm"
                        : "text-[#92400E] hover:bg-[#FEF3C7]"
                    }`}
                  >
                    <DoorOpen size={13} />
                    <span>
                      {simState.doorOpen || isDoorOpenContext(selectedZoneId || "zone-a")
                        ? `Door Open (${fmtDoorDuration(doorOpenSeconds)})`
                        : "Door Left Open"}
                    </span>
                  </button>
                  {!(simState.doorOpen || isDoorOpenContext(selectedZoneId || "zone-a")) && (
                    <div className="flex border-l border-[#FDE68A]">
                      <button
                        onClick={() => handleSimulateDoor(2)}
                        className="px-1.5 py-1 text-[10px] font-mono text-[#92400E] hover:bg-[#FEF3C7] border-r border-[#FDE68A]"
                        title="Open for 2 minutes"
                      >
                        2m
                      </button>
                      <button
                        onClick={() => handleSimulateDoor(5)}
                        className="px-1.5 py-1 text-[10px] font-mono text-[#92400E] hover:bg-[#FEF3C7]"
                        title="Open for 5 minutes"
                      >
                        5m
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Compressor Trip */}
                <button
                  onClick={handleToggleCompressor}
                  className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                    activeScenario === "compressor_failure" || selectedZone?.scenario === "compressor_failure"
                      ? "bg-[#EF4444] text-white font-bold border-[#EF4444] shadow-sm animate-pulse"
                      : "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] hover:bg-[#FEE2E2]"
                  }`}
                >
                  <PowerOff size={13} />
                  <span>{activeScenario === "compressor_failure" || selectedZone?.scenario === "compressor_failure" ? "Compressor Tripped (Offline)" : "Trip Compressor"}</span>
                </button>

                {/* 2b. Cooling Fan Off */}
                <button
                  onClick={handleToggleFan}
                  className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                    activeScenario === "fan_off" || selectedZone?.scenario === "fan_off"
                      ? "bg-[#F59E0B] text-white font-bold border-[#F59E0B] shadow-sm animate-pulse"
                      : "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A] hover:bg-[#FEF3C7]"
                  }`}
                  title="Simulate evaporator cooling fan failure"
                >
                  <Fan size={13} className={activeScenario === "fan_off" || selectedZone?.scenario === "fan_off" ? "text-white" : "text-[#F59E0B]"} />
                  <span>{activeScenario === "fan_off" || selectedZone?.scenario === "fan_off" ? "Cooling Fan Off" : "Fan Off"}</span>
                </button>

                {/* 3. Sensor Failures */}
                <button
                  onClick={handleToggleSensorFailure}
                  className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                    activeScenario === "sensor_anomaly" || selectedZone?.scenario === "sensor_anomaly"
                      ? "bg-[#8B5CF6] text-white font-bold border-[#8B5CF6] shadow-sm animate-pulse"
                      : "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE] hover:bg-[#EDE9FE]"
                  }`}
                >
                  <ZapOff size={13} />
                  <span>{activeScenario === "sensor_anomaly" || selectedZone?.scenario === "sensor_anomaly" ? "Sensor Fault Active" : "Sensor Fails"}</span>
                </button>

                {/* 4. Sensor Burning / Fire */}
                <button
                  onClick={handleToggleSensorBurning}
                  className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                    activeScenario === "fire_runaway" || activeScenario === "sensor_burn" || selectedZone?.scenario === "fire_runaway"
                      ? "bg-[#DC2626] text-white font-bold border-[#DC2626] shadow-md animate-bounce"
                      : "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] hover:bg-[#FEE2E2]"
                  }`}
                >
                  <Flame size={13} className={activeScenario === "fire_runaway" || selectedZone?.scenario === "fire_runaway" ? "text-white" : "text-[#DC2626]"} />
                  <span>{activeScenario === "fire_runaway" || activeScenario === "sensor_burn" || selectedZone?.scenario === "fire_runaway" ? "🔥 Sensor Burning!" : "Sensor Burning"}</span>
                </button>

                {/* 5. Cooling Degradation */}
                <button
                  onClick={handleToggleDegradation}
                  className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                    activeScenario === "cooling_degradation" || selectedZone?.scenario === "cooling_degradation"
                      ? "bg-[#2563EB] text-white font-bold border-[#2563EB] shadow-sm"
                      : "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] hover:bg-[#DBEAFE]"
                  }`}
                >
                  <ThermometerSnowflake size={13} />
                  <span>{activeScenario === "cooling_degradation" || selectedZone?.scenario === "cooling_degradation" ? "Degraded (45% Loss)" : "Degrade 45%"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {/* Telemetry Sensor Feed Mode */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#DCE8F6] bg-[#F1F7FF] text-[11px] font-mono">
                  <Database size={13} className="text-[#2563EB]" />
                  <span className="text-[#475569]">DATA FEED:</span>
                  <button
                    onClick={() =>
                      handleToggleTelemetrySource(
                        telemetrySourcePoll.data?.source === "dataset" ? "simulator" : "dataset"
                      )
                    }
                    className="font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer transition"
                    title="Click to toggle between Pre-recorded Sensor Dataset Playback and Live Feeder API / Simulator"
                  >
                    <span>
                      {telemetrySourcePoll.data?.source === "dataset"
                        ? `Dataset Playback (${telemetrySourcePoll.data.dataset_name ?? "test_dataset.csv"} - Row ${
                            telemetrySourcePoll.data.playback_index
                          }/${telemetrySourcePoll.data.total_timestamps})`
                        : "Live IoT / Simulator"}
                    </span>
                    <RefreshCw size={10} className="text-[#2563EB]" />
                  </button>
                </div>

                {/* Reset All Baseline */}
                <button
                  onClick={handleResetAll}
                  className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded-lg border bg-white text-[#475569] border-[#DCE8F6] hover:bg-[#F1F7FF] hover:text-[#0F172A] transition cursor-pointer flex items-center gap-1.5"
                  title="Reset all systems, sensors, compressors and doors to nominal"
                >
                  <RotateCcw size={13} className="text-[#2563EB]" />
                  <span>Reset Baseline</span>
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
                <div className="rounded-xl border border-[#DCE8F6] bg-white/95 px-3 py-2 text-[11px] font-mono backdrop-blur-md shadow-arctic-card flex flex-col gap-1 text-[#0F172A]">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8]" />
                    <span className="text-[#0F172A]">Temperature Sensor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                    <span className="text-[#0F172A]">Humidity Sensor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                    <span className="text-[#0F172A]">Airflow Sensor</span>
                  </div>
                </div>
              </div>

              {/* Floating Camera Controls on Right */}
              <div className="absolute top-4 right-3 z-30 flex flex-col items-center gap-1.5 pointer-events-auto">
                <button
                  onClick={() => setCameraPreset("isometric")}
                  className="w-8 h-8 rounded-lg bg-white/95 border border-[#DCE8F6] text-[#0F172A] flex items-center justify-center hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-all shadow-md cursor-pointer"
                  title="Reset Camera View"
                >
                  <Home size={15} className="text-[#2563EB]" />
                </button>

                <button
                  onClick={() => handleZoom(1)}
                  className="w-8 h-8 rounded-t-lg bg-white/95 border border-[#DCE8F6] text-[#0F172A] flex items-center justify-center hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-all shadow-md cursor-pointer mt-1"
                  title="Zoom In"
                >
                  <Plus size={15} />
                </button>

                <button
                  onClick={() => handleZoom(-1)}
                  className="w-8 h-8 rounded-b-lg bg-white/95 border-x border-b border-[#DCE8F6] text-[#0F172A] flex items-center justify-center hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-all shadow-md cursor-pointer"
                  title="Zoom Out"
                >
                  <Minus size={15} />
                </button>

                <button
                  onClick={handleResetNorth}
                  className="w-8 h-8 rounded-lg bg-white/95 border border-[#DCE8F6] text-[#0F172A] flex items-center justify-center hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-all shadow-md cursor-pointer mt-1"
                  title="Reset Orientation"
                >
                  <RotateCw size={15} className="text-[#2563EB]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT (col-span-4): ZONE TELEMETRY & OPERATIONS CARD */}
        <div className={is3DExpanded ? "xl:col-span-12" : "xl:col-span-4"}>
          <div className="rounded-2xl border border-[#DCE8F6] bg-white p-4 shadow-arctic-card flex flex-col justify-between h-full space-y-4">
            {/* Header: Zone Title + Status Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F6]">
              <div className="flex items-center gap-2">
                <Layers size={17} className="text-[#2563EB]" />
                <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
                  {selectedConfig.name} – Telemetry & Operations
                </h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  simState.doorOpen
                    ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] animate-pulse"
                    : simState.isRecovering
                    ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                    : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                }`}
              >
                {simState.doorOpen ? "● OPEN – INGRESS" : simState.isRecovering ? "● CLOSED – RECOVERING" : "● CLOSED – NORMAL"}
              </span>
            </div>

            {/* 8 Metric Tiles Grid (2 cols x 4 rows) */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Tile 1: Temperature */}
              <div className="rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-3 flex flex-col justify-between hover:border-[#BFDBFE] transition">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-[#475569] flex items-center gap-1 font-semibold">
                    <Thermometer size={14} className="text-[#2563EB]" />
                    <span>Temperature</span>
                  </div>
                  <DynamicSparkline data={tempHistory} color="#2563EB" />
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-xl font-bold font-mono text-[#0F172A]">
                    {fmtTemp(currentZoneTemp)}
                  </div>
                  {activeScenario !== "normal" && (
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border animate-pulse ${
                        activeScenario === "fire_runaway" || activeScenario === "sensor_burn"
                          ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]"
                          : activeScenario === "compressor_failure"
                          ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]"
                          : activeScenario === "door_open"
                          ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                          : activeScenario === "sensor_anomaly"
                          ? "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]"
                          : "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]"
                      }`}
                    >
                      {activeScenario === "fire_runaway" || activeScenario === "sensor_burn"
                        ? "+4.2°C/hr"
                        : activeScenario === "compressor_failure"
                        ? "+1.8°C/hr"
                        : activeScenario === "door_open"
                        ? "+2.8°C/hr"
                        : activeScenario === "sensor_anomaly"
                        ? "±4.5°C jitter"
                        : "+0.8°C/hr"}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[#475569] font-mono mt-0.5">
                  Target: {selectedConfig.tempRange}
                </div>
              </div>

              {/* Tile 2: Relative Humidity */}
              <div className="rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-3 flex flex-col justify-between hover:border-[#BFDBFE] transition">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-[#475569] flex items-center gap-1 font-semibold">
                    <Droplets size={14} className="text-[#38BDF8]" />
                    <span>Relative Humidity</span>
                  </div>
                  <DynamicSparkline data={humidityHistory} color="#38BDF8" />
                </div>
                <div className="text-xl font-bold font-mono text-[#0F172A] mt-1">
                  {simState.doorOpen
                    ? "78% RH"
                    : activeScenario === "sensor_anomaly"
                    ? "— (Dropout)"
                    : selectedZone?.humidity != null
                    ? `${Math.round(selectedZone.humidity)}%`
                    : "—"}
                </div>
                <div className="text-[10px] text-[#475569] font-mono mt-0.5">
                  {simState.doorOpen ? "Ambient Latent Rush" : "Target: 45% – 70%"}
                </div>
              </div>

              {/* Tile 3: Power Load */}
              <div className="rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-3 flex flex-col justify-between hover:border-[#BFDBFE] transition">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-[#475569] flex items-center gap-1 font-semibold">
                    <Zap size={14} className="text-[#F59E0B]" />
                    <span>Power Load</span>
                  </div>
                  <DynamicSparkline data={powerHistory} color="#10B981" />
                </div>
                <div className="text-xl font-bold font-mono text-[#0F172A] mt-1">
                  {!simState.compressorRunning
                    ? "0.45 kW"
                    : activeScenario === "cooling_degradation"
                    ? "4.60 kW"
                    : selectedZone?.power_consumption_kw != null
                    ? `${selectedZone.power_consumption_kw.toFixed(1)} kW`
                    : "— kW"}
                </div>
                <div className="text-[10px] text-[#475569] font-mono mt-0.5 truncate">
                  {!simState.compressorRunning
                    ? "Load: 0% · TRIPPED / OFFLINE"
                    : activeScenario === "cooling_degradation"
                    ? "Load: 100% · STRAIN (COP -45%)"
                    : `Load: ${selectedZone?.compressor_load_pct != null ? `${Math.round(selectedZone.compressor_load_pct)}%` : "78%"} · Compressor: ON`}
                </div>
              </div>

              {/* Tile 4: Sensor Probes */}
              {(() => {
                const targetSensorId = `${selectedZoneId.replace("zone-", "TS-").toUpperCase()}1`;
                const isBurned = simState.burnedSensors.has(targetSensorId) || activeScenario === "fire_runaway" || activeScenario === "sensor_burn";
                const isFailed = simState.failedSensors.has(targetSensorId) || activeScenario === "sensor_anomaly";
                const isAnomaly = selectedZone?.sensor_health && selectedZone.sensor_health !== "healthy";
                const probesOnline = isBurned || isFailed ? 1 : 2;
                const isDegraded = probesOnline < 2 || isAnomaly;

                return (
                  <div
                    className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
                      isBurned
                        ? "bg-[#FEF2F2] border-[#FECACA]"
                        : isFailed
                        ? "bg-[#F5F3FF] border-[#DDD6FE]"
                        : "border-[#DCE8F6] bg-[#F8FAFC] hover:border-[#BFDBFE]"
                    }`}
                  >
                    <div className="text-[11px] text-[#475569] flex items-center gap-1 font-semibold">
                      <Radio size={14} className={isBurned ? "text-[#EF4444]" : isDegraded ? "text-[#F59E0B]" : "text-[#10B981]"} />
                      <span>Sensor Probes</span>
                    </div>
                    <div className={`text-lg font-bold font-mono mt-1 flex items-center gap-1.5 ${isBurned ? "text-[#991B1B]" : isDegraded ? "text-[#92400E]" : "text-[#065F46]"}`}>
                      <span>{probesOnline} / 2</span>
                      <span className="text-xs font-semibold">{isBurned ? "Fire Hazard" : isDegraded ? "Degraded" : "Online"}</span>
                      {isBurned ? (
                        <Flame size={14} className="text-[#EF4444] animate-pulse" />
                      ) : isDegraded ? (
                        <AlertTriangle size={14} className="text-[#F59E0B]" />
                      ) : (
                        <CheckCircle2 size={14} className="text-[#10B981]" />
                      )}
                    </div>
                    <div className="text-[10px] text-[#475569] font-mono mt-0.5 truncate">
                      {isBurned
                        ? `${targetSensorId} Thermal Runaway`
                        : isFailed
                        ? `${targetSensorId} Outlier / Dropout`
                        : selectedZone?.sensor_issues?.[0]?.detail ??
                          selectedZone?.sensor_issues?.[0]?.type ??
                          "All sensors healthy"}
                    </div>
                  </div>
                );
              })()}

              {/* Tile 5: Residual Rise ΔT */}
              <div className="rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-3 flex flex-col justify-between hover:border-[#BFDBFE] transition">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-[#475569] flex items-center gap-1 font-semibold">
                    <Wind size={14} className="text-[#2563EB]" />
                    <span>Residual Rise ΔT</span>
                  </div>
                  <DynamicSparkline data={residualHistory} color="#2563EB" />
                </div>
                <div className="text-xl font-bold font-mono text-[#F59E0B] mt-1">
                  +{simState.doorOpen ? "1.8" : (selectedZone?.residual_rise_predicted ?? simState.residualRise ?? 0).toFixed(1)}°C
                </div>
                <div className="text-[10px] text-[#475569] font-mono mt-0.5">
                  Accumulated warm air
                </div>
              </div>

              {/* Tile 6: Predicted Peak Temp */}
              {(() => {
                const simulatedPeak =
                  activeScenario === "fire_runaway" || simState.burnedSensors.size > 0
                    ? selectedConfig.upperLimit + 7.8
                    : simState.doorOpen
                    ? selectedConfig.upperLimit + 3.4
                    : !simState.compressorRunning
                    ? selectedConfig.upperLimit + 4.9
                    : activeScenario === "cooling_degradation"
                    ? selectedConfig.upperLimit + 2.1
                    : null;

                const peakVal =
                  simulatedPeak ??
                  predictionOverviewPoll.data?.horizons?.["30"]?.predicted_peak_temperature ??
                  selectedZone?.peak_temp_predicted ??
                  currentZoneTemp;

                const isBreach = peakVal > selectedConfig.upperLimit;

                return (
                  <div
                    className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
                      isBreach ? "bg-[#FEF2F2] border-[#FECACA]" : "border-[#DCE8F6] bg-[#F8FAFC] hover:border-[#BFDBFE]"
                    }`}
                  >
                    <div className="text-[11px] text-[#475569] flex items-center gap-1 font-semibold">
                      <Thermometer size={14} className="text-[#EF4444]" />
                      <span>Predicted Peak Temp</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-[#991B1B] mt-1">
                      {fmtTemp(peakVal)}
                    </div>
                    <div className="text-[10px] text-[#475569] font-mono mt-0.5">
                      {isBreach ? "⚠️ Excursion Breach Imminent" : "Thermal inertia peak"}
                    </div>
                  </div>
                );
              })()}

              {/* Tile 7: Est. Recovery Duration */}
              {(() => {
                const simRec =
                  activeScenario === "fire_runaway" || simState.burnedSensors.size > 0
                    ? 55
                    : simState.doorOpen
                    ? 25 + Math.floor(doorOpenSeconds / 10)
                    : !simState.compressorRunning
                    ? 40
                    : activeScenario === "cooling_degradation"
                    ? 32
                    : null;

                const recMins = simRec ?? selectedZone?.recovery_time_minutes ?? simState.recoveryMinutes ?? 0;

                return (
                  <div className="rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-3 flex flex-col justify-between hover:border-[#BFDBFE] transition">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-[#475569] flex items-center gap-1 font-semibold">
                        <Clock size={14} className="text-[#2563EB]" />
                        <span>Est. Recovery Duration</span>
                      </div>
                      <DynamicSparkline data={recoveryHistory} color="#8B5CF6" />
                    </div>
                    <div className="text-xl font-bold font-mono text-[#2563EB] mt-1">
                      ~ {Math.round(recMins)} min
                    </div>
                    <div className="text-[10px] text-[#475569] font-mono mt-0.5">
                      Post-incident cooling
                    </div>
                  </div>
                );
              })()}

              {/* Tile 8: 24h Ingress Time */}
              <div className="rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-3 flex flex-col justify-between hover:border-[#BFDBFE] transition">
                <div className="text-[11px] text-[#475569] flex items-center gap-1 font-semibold">
                  <Calendar size={14} className="text-[#2563EB]" />
                  <span>24h Ingress Time</span>
                </div>
                <div className="text-xl font-bold font-mono text-[#0F172A] mt-1">
                  {(selectedZone?.cumulative_open_minutes_24h ?? 0).toFixed(0)} min
                </div>
                <div className="text-[10px] text-[#475569] font-mono mt-0.5">
                  {selectedZone?.door_events_count_24h ?? 0} events recorded
                </div>
              </div>
            </div>

            {/* Cooling Recovery Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#475569] font-medium">Cooling Recovery Progress</span>
                <span className="font-bold text-[#10B981]">
                  {Math.round(selectedZone?.recovery_progress_pct ?? simState.recoveryProgressPct ?? 100)}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden p-0.5 border border-[#CBD5E1]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#38BDF8] to-[#10B981] transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(5, selectedZone?.recovery_progress_pct ?? simState.recoveryProgressPct ?? 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Real-Time Situations & Fault Injection Control Grid */}
            <div className="pt-2 border-t border-[#DCE8F6] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#0F172A] font-bold flex items-center gap-1.5">
                  <Zap size={13} className="text-[#F59E0B]" />
                  <span>Simulate Situations</span>
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    activeScenario === "normal"
                      ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]"
                      : "bg-[#FEF2F2] border-[#FECACA] text-[#991B1B] animate-pulse"
                  }`}
                >
                  {activeScenario === "normal" ? "Nominal Baseline" : activeScenario.toUpperCase().replace("_", " ")}
                </span>
              </div>

              {/* Ingress Controls */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleSimulateDoor(2)}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-mono font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                    (simState.doorOpen || isDoorOpenContext(selectedZoneId || "zone-a")) &&
                    doorSimulations[selectedZoneId || "zone-a"]?.durationMinutes === 2
                      ? "border-[#F59E0B] bg-[#FFFBEB] text-[#92400E] font-bold"
                      : "border-[#DCE8F6] bg-white hover:bg-[#F1F7FF] text-[#475569]"
                  }`}
                  title="Simulate 2-minute door ingress"
                >
                  <DoorOpen size={12} className="text-[#F59E0B]" />
                  <span>
                    {(simState.doorOpen || isDoorOpenContext(selectedZoneId || "zone-a")) &&
                    doorSimulations[selectedZoneId || "zone-a"]?.durationMinutes === 2
                      ? `2m (${fmtDoorDuration(doorOpenSeconds)})`
                      : "Door (2m)"}
                  </span>
                </button>

                <button
                  onClick={() => handleSimulateDoor(5)}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-mono font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                    (simState.doorOpen || isDoorOpenContext(selectedZoneId || "zone-a")) &&
                    doorSimulations[selectedZoneId || "zone-a"]?.durationMinutes === 5
                      ? "border-[#F59E0B] bg-[#FFFBEB] text-[#92400E] font-bold"
                      : "border-[#DCE8F6] bg-white hover:bg-[#F1F7FF] text-[#475569]"
                  }`}
                  title="Simulate 5-minute door ingress"
                >
                  <DoorOpen size={12} className="text-[#F59E0B]" />
                  <span>
                    {(simState.doorOpen || isDoorOpenContext(selectedZoneId || "zone-a")) &&
                    doorSimulations[selectedZoneId || "zone-a"]?.durationMinutes === 5
                      ? `5m (${fmtDoorDuration(doorOpenSeconds)})`
                      : "Door (5m)"}
                  </span>
                </button>

                <button
                  onClick={() => handleSimulateDoor()}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-mono font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                    simState.doorOpen || isDoorOpenContext(selectedZoneId || "zone-a")
                      ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46] font-bold"
                      : "border-[#DCE8F6] bg-white hover:bg-[#F1F7FF] text-[#475569]"
                  }`}
                  title={simState.doorOpen || isDoorOpenContext(selectedZoneId || "zone-a") ? "Close and seal door" : "Open door continuously"}
                >
                  {simState.doorOpen || isDoorOpenContext(selectedZoneId || "zone-a") ? (
                    <Check size={12} className="text-[#10B981]" />
                  ) : (
                    <DoorOpen size={12} className="text-[#F59E0B]" />
                  )}
                  <span>{simState.doorOpen || isDoorOpenContext(selectedZoneId || "zone-a") ? "Seal Door" : "Continuous"}</span>
                </button>
              </div>

              {/* Equipment & Fault Injection Grid */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={handleToggleCompressor}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    !simState.compressorRunning
                      ? "border-[#EF4444] bg-[#FEF2F2] text-[#991B1B] shadow-sm animate-pulse"
                      : "border-[#FECACA] bg-[#FEF2F2]/60 hover:bg-[#FEE2E2] text-[#991B1B]"
                  }`}
                >
                  <PowerOff size={13} className={!simState.compressorRunning ? "text-[#EF4444]" : "text-[#991B1B]"} />
                  <span>{!simState.compressorRunning ? "Restore Compressor" : "Trip Compressor"}</span>
                </button>

                <button
                  onClick={handleToggleSensorFailure}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly"
                      ? "border-[#8B5CF6] bg-[#F5F3FF] text-[#6D28D9] shadow-sm animate-pulse"
                      : "border-[#DDD6FE] bg-[#F5F3FF]/60 hover:bg-[#EDE9FE] text-[#6D28D9]"
                  }`}
                >
                  <ZapOff size={13} className="text-[#8B5CF6]" />
                  <span>{simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly" ? "Clear Sensor Fault" : "Sensor Fails"}</span>
                </button>

                <button
                  onClick={handleToggleSensorBurning}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    simState.burnedSensors.size > 0 || activeScenario === "fire_runaway" || activeScenario === "sensor_burn"
                      ? "border-[#DC2626] bg-[#FEF2F2] text-[#991B1B] shadow-md animate-bounce"
                      : "border-[#FECACA] bg-[#FEF2F2]/60 hover:bg-[#FEE2E2] text-[#991B1B]"
                  }`}
                >
                  <Flame size={13} className="text-[#DC2626]" />
                  <span>{simState.burnedSensors.size > 0 || activeScenario === "fire_runaway" || activeScenario === "sensor_burn" ? "Extinguish Fire" : "Sensor Burning"}</span>
                </button>

                <button
                  onClick={handleToggleDegradation}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeScenario === "cooling_degradation"
                      ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] font-bold shadow-sm"
                      : "border-[#BFDBFE] bg-[#EFF6FF]/60 hover:bg-[#DBEAFE] text-[#2563EB]"
                  }`}
                >
                  <ThermometerSnowflake size={13} className="text-[#2563EB]" />
                  <span>{activeScenario === "cooling_degradation" ? "Restore COP" : "Degrade 45%"}</span>
                </button>
              </div>

              {/* Full Reset Baseline */}
              <button
                onClick={handleResetAll}
                className="w-full py-2 px-3 rounded-xl border border-[#DCE8F6] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] text-xs font-mono font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <RotateCcw size={13} className="text-[#2563EB]" />
                <span>Reset All Systems to Nominal</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MIDDLE SECTION: LIVE INCIDENT IMPACT ASSESSMENT & RESPONSE SOP PLAYBOOK
          (Dynamic real-time cascading impact across Thermal, Refrigeration, Telemetry, and Inventory Assets)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 shadow-arctic-card space-y-4">
        {/* Header: Title, Scenario Badge, Risk Score, and Quick Action */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#DCE8F6]">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${
                riskAnalysis.score >= 70
                  ? "bg-[#FEF2F2] border-[#FECACA] text-[#EF4444] animate-pulse"
                  : riskAnalysis.score >= 35
                  ? "bg-[#FFFBEB] border-[#FDE68A] text-[#F59E0B]"
                  : "bg-[#ECFDF5] border-[#A7F3D0] text-[#10B981]"
              }`}
            >
              {riskAnalysis.score >= 70 ? (
                <ShieldAlert size={22} />
              ) : riskAnalysis.score >= 35 ? (
                <AlertTriangle size={20} />
              ) : (
                <ShieldCheck size={22} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
                  Incident Impact Assessment & Response SOP Playbook
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border shadow-sm ${
                    simState.doorOpen
                      ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                      : !simState.compressorRunning
                      ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]"
                      : simState.burnedSensors.size > 0 || activeScenario === "fire_runaway" || activeScenario === "sensor_burn"
                      ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] animate-pulse"
                      : simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly"
                      ? "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]"
                      : activeScenario === "cooling_degradation"
                      ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]"
                      : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                  }`}
                >
                  {simState.doorOpen
                    ? "Dock Door Ingress Active (+26°C)"
                    : !simState.compressorRunning
                    ? "Compressor Offline (Loss of Cooling)"
                    : simState.burnedSensors.size > 0 || activeScenario === "fire_runaway" || activeScenario === "sensor_burn"
                    ? "Thermal Runaway / Sensor Fire"
                    : simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly"
                    ? "Sensor Dropout / Stuck Reading"
                    : activeScenario === "cooling_degradation"
                    ? "Cooling COP Degraded 45%"
                    : "Nominal Operating Baseline"}
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-0.5">
                Real-time multi-layer cascade analysis across thermal dynamics, plant telemetry, refrigeration strain, and inventory assets.
              </p>
            </div>
          </div>

          {/* Right Action & Risk Score */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Risk Score Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC]">
              <span className="text-[11px] font-mono text-[#475569] uppercase font-semibold">AI Risk Score</span>
              <span
                className={`text-sm font-mono font-black ${
                  riskAnalysis.score >= 70
                    ? "text-[#EF4444]"
                    : riskAnalysis.score >= 35
                    ? "text-[#F59E0B]"
                    : "text-[#10B981]"
                }`}
              >
                {Math.round(riskAnalysis.score)} / 100
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase ${
                  riskAnalysis.score >= 70
                    ? "bg-[#FEF2F2] text-[#991B1B]"
                    : riskAnalysis.score >= 35
                    ? "bg-[#FFFBEB] text-[#92400E]"
                    : "bg-[#ECFDF5] text-[#065F46]"
                }`}
              >
                {riskAnalysis.category}
              </span>
            </div>

            {/* Dynamic One-Click Mitigation Action */}
            {riskAnalysis.actionLabel && riskAnalysis.onAction ? (
              <button
                onClick={riskAnalysis.onAction}
                className="py-1.5 px-3.5 rounded-xl border border-[#2563EB] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-mono font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Sparkles size={13} className="text-sky-200 animate-spin" />
                <span>{riskAnalysis.actionLabel}</span>
              </button>
            ) : null}

            {/* Quick Reset Baseline */}
            <button
              onClick={handleResetAll}
              className="py-1.5 px-3 rounded-xl border border-[#DCE8F6] bg-white hover:bg-[#F1F7FF] text-[#475569] hover:text-[#0F172A] text-xs font-mono font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Reset all systems to nominal baseline"
            >
              <RotateCcw size={12} className="text-[#2563EB]" />
              <span>Reset All</span>
            </button>
          </div>
        </div>

        {/* Explainable AI Risk Factor Contributions */}
        <div className="rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-3">
          <div className="flex items-center justify-between text-xs font-mono text-[#475569] mb-2">
            <span className="flex items-center gap-1.5 font-bold text-[#0F172A]">
              <Cpu size={14} className="text-[#2563EB]" />
              <span>Active Risk Factor Point Contributions</span>
            </span>
            <span className="text-[11px] text-[#475569]">
              {riskAnalysis.factors.length} active risk vector{riskAnalysis.factors.length !== 1 ? "s" : ""}
            </span>
          </div>

          {riskAnalysis.factors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {riskAnalysis.factors.map((factor, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg border border-[#DCE8F6] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] shadow-sm"
                >
                  <span
                    className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      factor.points >= 50
                        ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]"
                        : factor.points >= 30
                        ? "bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]"
                        : "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]"
                    }`}
                  >
                    +{factor.points} pts
                  </span>
                  <span className="font-semibold text-[#0F172A]">{factor.label}:</span>
                  <span className="text-[#475569] text-[11px]">{factor.detail}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[#065F46] font-mono flex items-center gap-2 py-1">
              <CheckCircle2 size={14} className="text-[#10B981]" />
              <span>All telemetry signals within nominal parameters. 0 active risk penalties applied. Model confidence 94.2%.</span>
            </div>
          )}
        </div>

        {/* The 4 Cascading Impact Pillars (4-Column Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Pillar 1: Thermal Dynamics & Ingress Velocity */}
          <div className="rounded-xl border border-[#DCE8F6] bg-white p-3.5 flex flex-col justify-between space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#2563EB] text-xs font-mono font-bold uppercase tracking-wider">
                <Thermometer size={14} />
                <span>Thermal Dynamics</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  simState.doorOpen || !simState.compressorRunning || simState.burnedSensors.size > 0
                    ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]"
                    : activeScenario === "cooling_degradation"
                    ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                    : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                }`}
              >
                {simState.doorOpen
                  ? "Ingress Active"
                  : !simState.compressorRunning
                  ? "Chamber Warming"
                  : simState.burnedSensors.size > 0
                  ? "Thermal Runaway"
                  : activeScenario === "cooling_degradation"
                  ? "Slow Drift"
                  : "Equilibrium"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Drift Velocity</span>
                <span
                  className={`font-mono font-bold ${
                    simState.doorOpen
                      ? "text-[#EF4444] font-black animate-pulse"
                      : !simState.compressorRunning
                      ? "text-[#EF4444] font-black"
                      : simState.burnedSensors.size > 0
                      ? "text-[#DC2626] font-black"
                      : activeScenario === "cooling_degradation"
                      ? "text-[#F59E0B] font-bold"
                      : "text-[#10B981]"
                  }`}
                >
                  {simState.doorOpen
                    ? "+4.2°C/hr"
                    : !simState.compressorRunning
                    ? "+3.1°C/hr"
                    : simState.burnedSensors.size > 0
                    ? "+6.5°C/hr"
                    : activeScenario === "cooling_degradation"
                    ? "+1.8°C/hr"
                    : activeScenario === "sensor_anomaly"
                    ? "Erratic (Noisy)"
                    : "0.0°C/hr (Stable)"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Net Energy Ingress</span>
                <span className="font-mono text-[#0F172A] text-[11px] font-semibold">
                  {simState.doorOpen
                    ? "+3,850 W (Dock Air)"
                    : !simState.compressorRunning
                    ? "-3,200 W (No Chill)"
                    : simState.burnedSensors.size > 0
                    ? "+5,200 W (Localized)"
                    : activeScenario === "cooling_degradation"
                    ? "-1,440 W (Refrig Loss)"
                    : "Balanced (0 W Net)"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Projected Peak Temp</span>
                <span className="font-mono font-bold text-[#0F172A] text-xs">
                  {fmtTemp(
                    forecastData.length > 0 && activeScenario !== "normal"
                      ? Math.max(...forecastData.map((d) => d.temperature))
                      : currentZoneTemp
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Est. Time to Breach</span>
                <span
                  className={`font-mono font-bold text-xs ${
                    simState.doorOpen || !simState.compressorRunning || simState.burnedSensors.size > 0
                      ? "text-[#EF4444]"
                      : "text-[#0F172A]"
                  }`}
                >
                  {simState.doorOpen
                    ? `${Math.max(1, Math.round(22 - doorOpenSeconds / 10))} min`
                    : !simState.compressorRunning
                    ? "18 min"
                    : simState.burnedSensors.size > 0
                    ? "12 min"
                    : activeScenario === "cooling_degradation"
                    ? "42 min"
                    : activeScenario === "sensor_anomaly"
                    ? "Signal Corrupt"
                    : "> 60 min (Safe)"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#DCE8F6] flex items-center justify-between text-[11px] text-[#475569]">
              <span>Chamber Ambient</span>
              <span className="font-mono font-bold text-[#0F172A]">{fmtTemp(currentZoneTemp)}</span>
            </div>
          </div>

          {/* Pillar 2: Refrigeration Plant & Power Load */}
          <div className="rounded-xl border border-[#DCE8F6] bg-white p-3.5 flex flex-col justify-between space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#2563EB] text-xs font-mono font-bold uppercase tracking-wider">
                <Gauge size={14} />
                <span>Refrigeration Plant</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  !simState.compressorRunning
                    ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] animate-pulse"
                    : activeScenario === "cooling_degradation"
                    ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                    : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                }`}
              >
                {!simState.compressorRunning
                  ? "Plant Offline"
                  : activeScenario === "cooling_degradation"
                  ? "Degraded COP"
                  : "Compressor Online"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Compressor Rack</span>
                <span
                  className={`font-mono font-bold ${
                    !simState.compressorRunning ? "text-[#EF4444]" : "text-[#10B981]"
                  }`}
                >
                  {!simState.compressorRunning ? "TRIPPED (0.45 kW)" : "ACTIVE (3.2 kW)"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Evaporator Fans</span>
                <span
                  className={`font-mono ${
                    !simState.compressorRunning ? "text-[#94A3B8]" : "text-[#2563EB] font-semibold"
                  }`}
                >
                  {!simState.compressorRunning ? "Halted (0 RPM)" : "Circulating (1,450 RPM)"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Cooling Capacity</span>
                <span className="font-mono text-[#0F172A] text-[11px] font-semibold">
                  {!simState.compressorRunning
                    ? "0% (Zero Active Cooling)"
                    : activeScenario === "cooling_degradation"
                    ? "55% (COP Derated)"
                    : "100% (COP 3.2 Nominal)"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Breaker Panel Status</span>
                <span
                  className={`font-mono text-xs ${
                    !simState.compressorRunning ? "text-[#F59E0B] font-bold" : "text-[#0F172A]"
                  }`}
                >
                  {!simState.compressorRunning ? "Trip Interlock Closed" : "Normal 415V Phase"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#DCE8F6] flex items-center justify-between text-[11px] text-[#475569]">
              <span>Inspect 3D Equipment</span>
              <button
                onClick={() => setCameraPreset("plant-room")}
                className="text-[#2563EB] hover:text-[#1D4ED8] font-mono text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Focus Plant Room</span>
                <ArrowRight size={10} />
              </button>
            </div>
          </div>

          {/* Pillar 3: Telemetry Stream & Sensor Health */}
          <div className="rounded-xl border border-[#DCE8F6] bg-white p-3.5 flex flex-col justify-between space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#2563EB] text-xs font-mono font-bold uppercase tracking-wider">
                <Radio size={14} />
                <span>Telemetry Stream</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  simState.burnedSensors.size > 0
                    ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] animate-pulse"
                    : simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly"
                    ? "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]"
                    : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                }`}
              >
                {simState.burnedSensors.size > 0
                  ? "Probe Burned"
                  : simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly"
                  ? "Anomaly Detected"
                  : "All Probes 100%"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Active Sensor Probes</span>
                <span
                  className={`font-mono font-bold ${
                    simState.burnedSensors.size > 0 || simState.failedSensors.size > 0
                      ? "text-[#F59E0B]"
                      : "text-[#10B981]"
                  }`}
                >
                  {simState.burnedSensors.size > 0 || simState.failedSensors.size > 0
                    ? "1 / 2 Online (50% Degraded)"
                    : "2 / 2 Online (100% Nominal)"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Isolation Forest Score</span>
                <span
                  className={`font-mono font-bold ${
                    activeScenario === "sensor_anomaly" || simState.failedSensors.size > 0
                      ? "text-[#6D28D9] font-black animate-pulse"
                      : simState.burnedSensors.size > 0
                      ? "text-[#EF4444] font-black"
                      : "text-[#10B981]"
                  }`}
                >
                  {activeScenario === "sensor_anomaly" || simState.failedSensors.size > 0
                    ? "0.98 (Critical Outlier)"
                    : simState.burnedSensors.size > 0
                    ? "0.99 (Severe Spike)"
                    : "0.02 (Nominal Inlier)"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">AI Confidence Index</span>
                <span className="font-mono text-[#0F172A] text-[11px] font-semibold">
                  {activeScenario === "sensor_anomaly"
                    ? "42.0% (Synthetic Fallback)"
                    : simState.burnedSensors.size > 0
                    ? "96.5% (Thermal Spike Certain)"
                    : "94.2% (High Confidence)"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Redundant Node TS-A2</span>
                <span className="font-mono text-[#10B981] text-xs font-semibold">
                  Online & Calibrated
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#DCE8F6] flex items-center justify-between text-[11px] text-[#475569]">
              <span>Inspect Sensor in 3D</span>
              <button
                onClick={() => setCameraPreset("dock-bay")}
                className="text-[#2563EB] hover:text-[#1D4ED8] font-mono text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Focus Dock Bay</span>
                <ArrowRight size={10} />
              </button>
            </div>
          </div>

          {/* Pillar 4: Product Asset Value & Regulatory Compliance */}
          <div className="rounded-xl border border-[#DCE8F6] bg-white p-3.5 flex flex-col justify-between space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#2563EB] text-xs font-mono font-bold uppercase tracking-wider">
                <Boxes size={14} />
                <span>Inventory & Assets</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  simState.doorOpen || !simState.compressorRunning || simState.burnedSensors.size > 0
                    ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]"
                    : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                }`}
              >
                {simState.doorOpen || !simState.compressorRunning || simState.burnedSensors.size > 0
                  ? "At Financial Risk"
                  : "Assets Protected"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Monitored Inventory</span>
                <span className="font-mono font-bold text-[#0F172A] text-xs">
                  {selectedZoneId === "zone-a"
                    ? "$142,500 Biologics"
                    : selectedZoneId === "zone-b"
                    ? "$38,000 Proteins"
                    : "$65,000 Pharma API"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Compliance Audit</span>
                <span
                  className={`font-mono text-xs font-semibold ${
                    simState.doorOpen || !simState.compressorRunning || simState.burnedSensors.size > 0
                      ? "text-[#EF4444]"
                      : "text-[#10B981]"
                  }`}
                >
                  {simState.doorOpen || !simState.compressorRunning || simState.burnedSensors.size > 0
                    ? "FDA 21 CFR Part 11 Risk"
                    : "GDP & MKT Compliant"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Residual Thermal Lag</span>
                <span className="font-mono text-[#0F172A] text-[11px] font-semibold">
                  {simState.doorOpen
                    ? "~18 min Post-Closure Wave"
                    : !simState.compressorRunning
                    ? "~35 min Thermal Inertia"
                    : "Nominal Cooling Margin"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">SOP Reference Code</span>
                <span className="font-mono text-[#2563EB] text-[11px] font-bold">
                  {simState.doorOpen
                    ? "SOP-COLD-041 (Dock Ingress)"
                    : !simState.compressorRunning
                    ? "SOP-HVAC-102 (Trip Override)"
                    : simState.burnedSensors.size > 0
                    ? "SOP-SEC-009 (Fire Runaway)"
                    : simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly"
                    ? "SOP-IOT-022 (Sensor Fault)"
                    : activeScenario === "cooling_degradation"
                    ? "SOP-HVAC-055 (De-icing COP)"
                    : "SOP-GEN-001 (Routine)"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#DCE8F6] flex items-center justify-between text-[11px] text-[#475569]">
              <span>Facility Zone</span>
              <span className="font-mono font-bold text-[#0F172A]">{selectedConfig.name}</span>
            </div>
          </div>
        </div>

        {/* Operator SOP Action Playbook (3-Step Checklist) */}
        <div className="rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#0F172A]">
              <Terminal size={14} className="text-[#2563EB]" />
              <span>Standard Operating Procedure (SOP) Action Checklist</span>
            </div>
            <span className="text-[11px] font-mono text-[#475569]">
              Active Protocol:{" "}
              <span className="text-[#2563EB] font-bold">
                {simState.doorOpen
                  ? "SOP-COLD-041 (Ingress Containment)"
                  : !simState.compressorRunning
                  ? "SOP-HVAC-102 (Compressor Breaker Reset)"
                  : simState.burnedSensors.size > 0
                  ? "SOP-SEC-009 (Emergency Fire Suppression)"
                  : simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly"
                  ? "SOP-IOT-022 (Sensor Anomaly Isolation)"
                  : activeScenario === "cooling_degradation"
                  ? "SOP-HVAC-055 (Condenser Restoral)"
                  : "SOP-GEN-001 (Routine Monitoring)"}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
            {/* Step 1: Containment */}
            <div className="rounded-lg border border-[#DCE8F6] bg-white p-2.5 flex items-start gap-2.5 shadow-sm">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                  simState.doorOpen || !simState.compressorRunning || simState.burnedSensors.size > 0 || simState.failedSensors.size > 0 || activeScenario === "cooling_degradation"
                    ? "bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]"
                    : "bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]"
                }`}
              >
                1
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-[#0F172A]">Step 1: Immediate Containment</div>
                <p className="text-[#475569] text-[11px] leading-relaxed">
                  {simState.doorOpen
                    ? "Engage magnetic seals and seal dock door to halt +26°C air ingress."
                    : !simState.compressorRunning
                    ? "Verify electrical breaker panel and reset auxiliary trip contact."
                    : simState.burnedSensors.size > 0
                    ? "Isolate 24V DC sensor bus line and trigger localized fire suppressant."
                    : simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly"
                    ? "Flag corrupted telemetry stream and switch HVAC loop to ensemble mode."
                    : activeScenario === "cooling_degradation"
                    ? "Inspect condenser coils for dust clogging or refrigerant pressure drops."
                    : "All chambers sealed and operating within thermal envelope limits."}
                </p>
                {riskAnalysis.actionLabel && riskAnalysis.onAction && (
                  <button
                    onClick={riskAnalysis.onAction}
                    className="mt-1 text-[10px] font-mono font-bold text-[#2563EB] hover:text-[#1D4ED8] underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Execute Step 1 Action</span>
                    <ArrowRight size={10} />
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: System Stabilization */}
            <div className="rounded-lg border border-[#DCE8F6] bg-white p-2.5 flex items-start gap-2.5 shadow-sm">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono font-bold shrink-0 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                2
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-[#0F172A]">Step 2: Thermal Stabilization</div>
                <p className="text-[#475569] text-[11px] leading-relaxed">
                  {simState.doorOpen
                    ? "Run booster evaporator fans at 100% capacity to overcome residual thermal lag."
                    : !simState.compressorRunning
                    ? "Engage secondary backup condensing unit and confirm refrigerant suction pressure."
                    : simState.burnedSensors.size > 0
                    ? "Route chamber temperature control loop to redundant probe TS-A2."
                    : simState.failedSensors.size > 0 || activeScenario === "sensor_anomaly"
                    ? "Recalibrate probe zero-point and verify RF telemetry gateway sync."
                    : activeScenario === "cooling_degradation"
                    ? "Perform hot gas defrost cycle to clear icing on evaporator fins."
                    : "Continuously calculate predictive drift curves and Mean Kinetic Temperature."}
                </p>
                <div className="text-[10px] font-mono text-[#64748B]">
                  Target Stabilization: &lt; {selectedConfig.upperLimit}°C
                </div>
              </div>
            </div>

            {/* Step 3: Audit & Regulatory Log */}
            <div className="rounded-lg border border-[#DCE8F6] bg-white p-2.5 flex items-start gap-2.5 shadow-sm">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono font-bold shrink-0 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                3
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-[#0F172A]">Step 3: FDA / GDP Compliance Audit</div>
                <p className="text-[#475569] text-[11px] leading-relaxed">
                  Timestamp incident telemetry into immutable FDA 21 CFR Part 11 audit ledger and generate excursion incident report.
                </p>
                <div className="pt-0.5 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] font-semibold">
                    Audit Log Active
                  </span>
                  <button
                    onClick={() => setActiveAnalyticsTab("events")}
                    className="text-[10px] font-mono text-[#2563EB] hover:text-[#1D4ED8] underline cursor-pointer"
                  >
                    View Events Log
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          LOWER SECTION: TEMPERATURE FORECAST & ANALYTICS (FULL WIDTH)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 shadow-arctic-card">
        {/* Header: Title + Center Tabs + Right Projection Mode */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#DCE8F6]">
          <div className="flex items-center gap-2.5">
            <LineChartIcon size={18} className="text-[#2563EB]" />
            <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
              Temperature Forecast & Analytics
            </h3>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-[#EFF6FF] p-1 rounded-xl border border-[#DCE8F6] flex-wrap">
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
                    ? "bg-[#2563EB] text-white shadow-sm font-bold"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-white/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Projection Mode */}
          <div className="flex items-center gap-2 text-xs font-mono text-[#0F172A]">
            <span className="text-[#475569]">Projection Mode:</span>
            <div className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#DCE8F6] flex items-center gap-1.5 font-semibold text-[#0F172A]">
              <span>Live AI Forecast (30 min)</span>
              <ChevronDown size={13} className="text-[#475569]" />
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
                    <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="minute" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      domain={yDomain}
                      label={{ value: "Temperature (°C)", angle: -90, position: "insideLeft", fill: "#64748B", fontSize: 10, dx: 15 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-[#DCE8F6] bg-white p-2.5 text-xs font-mono shadow-xl">
                            <div className="text-[#475569] mb-1">{data.minute} ahead</div>
                            <div className="text-[#2563EB] font-bold">Predicted: {data.temperature}°C</div>
                            <div className="text-[#64748B] text-[10px]">
                              Safe: {selectedConfig.lowerLimit}°C – {selectedConfig.upperLimit}°C
                            </div>
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
                      stroke="#2563EB"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Lower Limit (${selectedConfig.lowerLimit}°C)`,
                        fill: "#2563EB",
                        fontSize: 10,
                        position: "insideBottomLeft",
                      }}
                    />

                    {/* Confidence Range Area Shading */}
                    <Area
                      type="monotone"
                      dataKey="temperature"
                      fill="#38BDF8"
                      fillOpacity={0.12}
                      stroke="none"
                    />

                    {/* Cyan Predicted Temperature Line with Dots */}
                    <Line
                      type="monotone"
                      dataKey="temperature"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#2563EB", stroke: "#FFFFFF", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "#FFFFFF", stroke: "#2563EB", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend (Matching Reference Image) */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#475569] font-mono pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-0.5 bg-[#2563EB] rounded" />
                  <span>Predicted Temperature</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-3 rounded bg-[#EFF6FF] border border-[#BFDBFE]" />
                  <span>Confidence Range</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 border-b-2 border-dashed border-[#EF4444]" />
                  <span className="text-[#EF4444]">Upper Limit ({selectedConfig.upperLimit}°C)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 border-b-2 border-dashed border-[#2563EB]" />
                  <span className="text-[#2563EB]">Lower Limit ({selectedConfig.lowerLimit}°C)</span>
                </div>
              </div>
            </div>

            {/* AI Model Card (col-span-4, Matching Reference Image) */}
            <div className="lg:col-span-4 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-4 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 text-[#2563EB] text-xs font-mono font-bold uppercase tracking-wider mb-1">
                  <Cpu size={15} />
                  <span>AI Model</span>
                </div>
                <h4 className="text-base font-bold text-[#0F172A] tracking-tight">
                  {modelEvaluationPoll.data?.model_architecture ?? "Multi-Output Random Forest"}
                </h4>
                <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                  {predictionOverviewPoll.data?.ai_explanation?.narrative ??
                    "Predicts temperature, humidity and recovery time using calibrated thermodynamic decay modeling."}
                </p>
              </div>

              {/* 3 Metric Tiles in a Row */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {/* Predicted Peak Temp */}
                {(() => {
                  const peakVal = activeScenario !== "normal" && forecastData.length > 0
                    ? Math.max(...forecastData.map(d => d.temperature))
                    : (predictionOverviewPoll.data?.horizons?.["30"]?.predicted_peak_temperature ??
                       selectedZone?.peak_temp_predicted ??
                       currentZoneTemp);
                  const isBreach = peakVal > selectedConfig.upperLimit || peakVal < selectedConfig.lowerLimit;
                  const isWarn = peakVal > selectedConfig.upperLimit - 1.0;
                  const peakBadge = isBreach ? "Excursion" : isWarn ? "At Risk" : "Safe";
                  const badgeColor = isBreach
                    ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]"
                    : isWarn
                    ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                    : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]";

                  return (
                    <div className="rounded-lg bg-white border border-[#DCE8F6] p-2.5 flex flex-col justify-between shadow-sm">
                      <div className="text-[10px] text-[#475569] font-mono flex items-center gap-1 font-semibold">
                        <Thermometer size={12} className="text-[#2563EB]" />
                        <span>Predicted Peak</span>
                      </div>
                      <div className="text-base font-bold font-mono text-[#0F172A] mt-1">
                        {fmtTemp(peakVal)}
                      </div>
                      <div className="mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeColor}`}>
                          {peakBadge}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Time to Limit */}
                {(() => {
                  const timeToLimit = activeScenario === "door_open"
                    ? Math.max(1, Math.round(22 - doorOpenSeconds / 10))
                    : activeScenario === "compressor_failure"
                    ? 18
                    : activeScenario === "fan_off"
                    ? 28
                    : (activeScenario === "fire_runaway" || activeScenario === "sensor_burn")
                    ? 12
                    : activeScenario === "cooling_degradation"
                    ? 42
                    : activeScenario === "sensor_anomaly"
                    ? null
                    : (predictionOverviewPoll.data?.horizons?.["30"]?.time_to_breach_minutes ??
                       selectedZone?.time_to_breach_minutes);
                  const isUrgent = timeToLimit != null && timeToLimit <= 15;
                  const isWarning = timeToLimit != null;
                  const badgeText = isUrgent ? "Critical" : isWarning ? "Warning" : activeScenario === "sensor_anomaly" ? "Telemetry Lost" : "Safe";
                  const badgeColor = isUrgent || activeScenario === "sensor_anomaly"
                    ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]"
                    : isWarning
                    ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                    : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]";

                  return (
                    <div className="rounded-lg bg-white border border-[#DCE8F6] p-2.5 flex flex-col justify-between shadow-sm">
                      <div className="text-[10px] text-[#475569] font-mono flex items-center gap-1 font-semibold">
                        <Clock size={12} className="text-[#F59E0B]" />
                        <span>Time to Limit</span>
                      </div>
                      <div className="text-base font-bold font-mono text-[#0F172A] mt-1">
                        {timeToLimit != null ? `${Math.round(timeToLimit)} min` : activeScenario === "sensor_anomaly" ? "N/A" : "> 60 min"}
                      </div>
                      <div className="mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeColor}`}>
                          {badgeText}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Model Confidence */}
                {(() => {
                  const f1 = activeScenario === "sensor_anomaly"
                    ? 0.42
                    : (modelEvaluationPoll.data?.excursion_classification_30m?.f1_score ?? 0.925);
                  const confPct = Math.round(f1 * 100);
                  const confBadge = f1 >= 0.85 ? "High" : f1 >= 0.7 ? "Moderate" : "Low";
                  const badgeColor =
                    f1 >= 0.85
                      ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                      : "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]";

                  return (
                    <div className="rounded-lg bg-white border border-[#DCE8F6] p-2.5 flex flex-col justify-between shadow-sm">
                      <div className="text-[10px] text-[#475569] font-mono flex items-center gap-1 font-semibold">
                        <TrendingUp size={12} className="text-[#8B5CF6]" />
                        <span>Confidence</span>
                      </div>
                      <div className="text-base font-bold font-mono text-[#0F172A] mt-1">
                        {confPct}%
                      </div>
                      <div className="mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeColor}`}>
                          {confBadge}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Dynamic Perishable Inventory Spoilage Section */}
              {predictionOverviewPoll.data?.ai_explanation?.inventory_spoilage_risk && (
                <div className="rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] p-3 mt-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#BFDBFE]">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] font-mono">
                      <Package size={13} className="text-[#2563EB]" />
                      <span>PERISHABLE INVENTORY RISK</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        predictionOverviewPoll.data.ai_explanation.inventory_spoilage_risk.spoilage_status.includes("Critical")
                          ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]"
                          : predictionOverviewPoll.data.ai_explanation.inventory_spoilage_risk.spoilage_status.includes("Warning")
                          ? "bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]"
                          : "bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]"
                      }`}
                    >
                      {predictionOverviewPoll.data.ai_explanation.inventory_spoilage_risk.spoilage_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] font-mono">
                    <div className="p-1.5 rounded bg-white border border-[#DCE8F6]">
                      <span className="text-[#475569]">Total Lot Value: </span>
                      <span className="text-[#10B981] font-bold">
                        {predictionOverviewPoll.data.ai_explanation.inventory_spoilage_risk.total_inventory_value_usd}
                      </span>
                    </div>
                    <div className="p-1.5 rounded bg-white border border-[#DCE8F6]">
                      <span className="text-[#475569]">Time to Spoilage: </span>
                      <span className="text-[#F59E0B] font-bold">
                        {predictionOverviewPoll.data.ai_explanation.inventory_spoilage_risk.time_to_spoilage_minutes != null
                          ? `${predictionOverviewPoll.data.ai_explanation.inventory_spoilage_risk.time_to_spoilage_minutes} min`
                          : "Nominal (Safe)"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-[#0F172A] space-y-1">
                    <div className="text-[10px] font-mono text-[#475569] uppercase font-semibold">
                      Stored Vulnerable Products:
                    </div>
                    {predictionOverviewPoll.data.ai_explanation.inventory_spoilage_risk.vulnerable_items.map((it, idx) => (
                      <div key={idx} className="flex items-start gap-1">
                        <span className="text-[#2563EB] font-bold">•</span>
                        <span>{it}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 p-2 rounded bg-white border border-[#DCE8F6] text-[10px] text-[#475569] leading-relaxed font-sans">
                    <span className="font-bold text-[#0F172A]">Degradation Mechanism: </span>
                    {predictionOverviewPoll.data.ai_explanation.inventory_spoilage_risk.spoilage_mechanism}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: What-If Counterfactual Simulator */}
        {activeAnalyticsTab === "what-if" && (
          <div className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC] p-3 rounded-xl border border-[#DCE8F6]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#0F172A] font-semibold">Scenario:</span>
                <select
                  value={whatIfScenario}
                  onChange={(e) => setWhatIfScenario(e.target.value as any)}
                  className="bg-white border border-[#DCE8F6] rounded-lg px-2.5 py-1 text-xs font-mono text-[#0F172A] cursor-pointer"
                >
                  <option value="door_open">Door Left Open (Air Ingress)</option>
                  <option value="compressor_failure">Compressor Failure (0 kW)</option>
                  <option value="cooling_degradation">Cooling Degradation (50%)</option>
                  <option value="abnormal_humidity">High Humidity Ingress</option>
                  <option value="fire_runaway">Fire / Thermal Runaway</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#0F172A] font-semibold">Duration:</span>
                {[5, 10, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setWhatIfDuration(mins)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                      whatIfDuration === mins
                        ? "bg-[#2563EB] text-white font-bold"
                        : "bg-white text-[#475569] border border-[#DCE8F6] hover:bg-[#EFF6FF]"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              <button
                onClick={handleRunWhatIf}
                disabled={whatIfLoading}
                className="px-4 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-mono text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
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
                    <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="minute" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip />
                    <ReferenceLine y={whatIfResult.limits.upper} stroke="#EF4444" strokeDasharray="4 4" />
                    <ReferenceLine y={whatIfResult.limits.lower} stroke="#2563EB" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="baseline" stroke="#2563EB" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="scenario" stroke="#EF4444" strokeWidth={2.5} strokeDasharray="4 4" dot={false} />
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
              const isCompressorRunning = zoneData?.compressor_status === "running";
              return (
                <div
                  key={`matrix-${cfg.id}`}
                  onClick={() => handleZoneSelect(cfg.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected ? "bg-[#EFF6FF] border-[#2563EB] shadow-md" : "bg-white border-[#DCE8F6] hover:border-[#BFDBFE] shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#0F172A] text-sm">{cfg.name}</span>
                    <span className="text-[10px] font-mono text-[#2563EB] font-bold">{cfg.product}</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-[#0F172A] mb-2">{fmtTemp(temp)}</div>
                  <div className="text-xs text-[#475569] font-mono space-y-1">
                    <div>Safe Range: {cfg.tempRange}</div>
                    <div>Humidity: {zoneData?.humidity != null ? `${Math.round(zoneData.humidity)}%` : "—"}</div>
                    <div>Power: {zoneData?.power_consumption_kw != null ? `${zoneData.power_consumption_kw.toFixed(1)} kW` : "— kW"}</div>
                    <div>Compressor: <span className={isCompressorRunning ? "text-[#10B981] font-bold" : "text-[#EF4444] font-bold"}>{zoneData?.compressor_status ? zoneData.compressor_status.toUpperCase() : "RUNNING"}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 4: Events & Recovery Log */}
        {activeAnalyticsTab === "events" && (
          <div className="pt-4 overflow-x-auto">
            {(() => {
              const rawEvents = facilityEventsPoll.data ?? [];
              const combinedEvents = [
                ...activityLog.map((ev) => ({
                  time: ev.time,
                  zone: ev.zone,
                  event: ev.message,
                  severity: ev.type,
                  status: "active",
                  action: null,
                })),
                ...rawEvents.map((ev) => ({
                  time: ev.time,
                  zone: ev.zone_name,
                  event: ev.event,
                  severity: ev.severity === "high" ? "critical" : ev.severity === "medium" ? "warning" : "info",
                  status: ev.status,
                  action: ev.recommended_action,
                })),
              ];

              if (combinedEvents.length === 0) {
                return (
                  <div className="py-8 text-center text-[#475569] font-mono text-xs">
                    No active or historical alarm events recorded. Facility running nominal.
                  </div>
                );
              }

              return (
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-[#DCE8F6] text-[#475569] uppercase text-[11px]">
                      <th className="pb-2">Time</th>
                      <th className="pb-2">Zone</th>
                      <th className="pb-2">Event Description</th>
                      <th className="pb-2">Severity</th>
                      <th className="pb-2">Action / Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE8F6]">
                    {combinedEvents.map((ev, i) => (
                      <tr key={i} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 text-[#475569]">{ev.time}</td>
                        <td className="py-2.5 text-[#0F172A] font-bold">{ev.zone}</td>
                        <td className="py-2.5 text-[#0F172A]">{ev.event}</td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ev.severity === "critical"
                                ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]"
                                : ev.severity === "warning"
                                ? "bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]"
                                : "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]"
                            }`}
                          >
                            {ev.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 text-[#475569] text-[11px] truncate max-w-xs">
                          {ev.action ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        )}

        {/* Tab 5: Sensor Health */}
        {activeAnalyticsTab === "health" && (
          <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            {/* Total Probes */}
            {(() => {
              const totalProbes = 6;
              const burnedCount = simState.burnedSensors.size;
              const failedCount = simState.failedSensors.size;
              const degradedZones = allZones.filter((z) => z.sensor_health && z.sensor_health !== "healthy").length;
              const offlineProbes = Math.max(burnedCount + failedCount, degradedZones);
              const onlineProbes = Math.max(0, totalProbes - offlineProbes);
              const pctOnline = Math.round((onlineProbes / totalProbes) * 100);
              const isHealthy = offlineProbes === 0;

              return (
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] shadow-sm">
                  <span className="text-[#475569]">Total Probes</span>
                  <div className="text-lg font-bold text-[#0F172A] mt-1">
                    {onlineProbes} / {totalProbes} Online
                  </div>
                  <div className={`text-[10px] mt-0.5 font-bold ${isHealthy ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                    {pctOnline}% Operational {offlineProbes > 0 ? `(${offlineProbes} Fault)` : ""}
                  </div>
                </div>
              );
            })()}

            {/* Telemetry Stream */}
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] shadow-sm">
              <span className="text-[#475569]">Telemetry Stream</span>
              <div className="text-lg font-bold text-[#2563EB] mt-1">
                {health?.status === "ok" ? "FastSync Active" : "Stream Degraded"}
              </div>
              <div className="text-[#475569] text-[10px] mt-0.5">
                {health?.tick_seconds ? `${health.tick_seconds}s cycle` : "1.0s cycle"} • {health?.readings_stored?.toLocaleString() ?? 0} records
              </div>
            </div>

            {/* Isolation Forest Anomaly Detection */}
            {(() => {
              const isAnomaly = selectedZone?.sensor_health && selectedZone.sensor_health !== "healthy";
              const firstIssue = selectedZone?.sensor_issues?.[0];
              const issueLabel =
                typeof firstIssue === "string"
                  ? firstIssue
                  : firstIssue?.detail ?? firstIssue?.type ?? selectedZone?.sensor_health?.replace("_", " ");

              return (
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] shadow-sm">
                  <span className="text-[#475569]">Isolation Forest</span>
                  <div className={`text-lg font-bold mt-1 ${isAnomaly ? "text-[#EF4444]" : "text-[#10B981]"}`}>
                    {isAnomaly ? "Anomaly Detected" : "Nominal"}
                  </div>
                  <div className="text-[#475569] text-[10px] mt-0.5 truncate">
                    {isAnomaly ? issueLabel : "Outlier score: normal"}
                  </div>
                </div>
              );
            })()}

            {/* Model Pipeline */}
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] shadow-sm">
              <span className="text-[#475569]">Model Pipeline</span>
              <div className="text-lg font-bold text-[#8B5CF6] mt-1 truncate">
                {modelEvaluationPoll.data?.model_architecture ? "Random Forest" : "RF Regressor"}
              </div>
              <div className="text-[#475569] text-[10px] mt-0.5">
                {modelEvaluationPoll.data?.n_train_samples
                  ? `${modelEvaluationPoll.data.n_train_samples.toLocaleString()} samples`
                  : "Trained physics model"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CONSEQUENTIAL ACTION SAFETY CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {confirmModal && confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#FECACA] bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FEF2F2] text-[#EF4444] border border-[#FECACA]">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">{confirmModal.title}</h3>
                <div className="text-xs text-[#991B1B] font-mono font-semibold">Consequential Simulation Event</div>
              </div>
            </div>

            <p className="text-xs text-[#475569] leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="rounded-lg bg-[#FEF2F2] border border-[#FECACA] p-3 text-[11px] font-mono text-[#991B1B]">
              <div className="font-bold text-[#DC2626] mb-1">Operational Impact:</div>
              {confirmModal.impact}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE8F6]">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-[#DCE8F6] text-xs font-mono text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F7FF] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-1.5 rounded-lg border border-[#EF4444] bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-mono font-bold transition shadow-sm cursor-pointer"
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
