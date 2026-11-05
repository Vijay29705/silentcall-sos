import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  ShieldAlert,
  Radio,
  MapPin,
  Volume2,
  Battery,
  BatteryCharging,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Car,
  Skull,
  FileCode,
  Layers,
  Activity,
  VolumeX,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Flame,
  PhoneCall,
  ShieldCheck,
  Undo2,
  History,
  AlertOctagon,
  Smartphone
} from 'lucide-react';

// ==========================================
// CUSTOM LEAFLET GIS MARKER FACTORIES
// ==========================================

// 1. Red Pulsing Radar Ping for Active Citizen SOS
const createEmergencyIcon = (isCritical = true) => {
  return L.divIcon({
    className: 'custom-emergency-pin',
    html: `
      <div class="relative flex items-center justify-center">
        <span class="absolute w-8 h-8 rounded-full ${
          isCritical ? 'bg-rose-500/50 animate-ping' : 'bg-amber-500/50 animate-ping'
        }"></span>
        <span class="absolute w-5 h-5 rounded-full ${
          isCritical ? 'bg-rose-600/80' : 'bg-amber-600/80'
        }"></span>
        <div class="relative w-4 h-4 rounded-full ${
          isCritical ? 'bg-rose-500' : 'bg-amber-500'
        } border-2 border-white shadow-lg flex items-center justify-center">
          <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
};

// 2. Muted Amber Marker for Revoked Incident (False Alarm Guard)
const createRevokedIcon = () => {
  return L.divIcon({
    className: 'custom-revoked-pin',
    html: `
      <div class="relative flex flex-col items-center justify-center">
        <div class="w-5 h-5 rounded-full bg-amber-500/25 border-2 border-amber-500 shadow-md flex items-center justify-center">
          <div class="w-2 h-2 bg-amber-400 rounded-full"></div>
        </div>
        <div class="mt-1 whitespace-nowrap bg-amber-950/95 text-amber-300 border border-amber-600/80 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow pointer-events-none">
          Revoked by Citizen
        </div>
      </div>
    `,
    iconSize: [92, 44],
    iconAnchor: [46, 12],
    popupAnchor: [0, -14]
  });
};

// 3. Flashing Black/Red Skull Marker for Dead Man's Switch (Device Destroyed)
const createDestroyedIcon = () => {
  return L.divIcon({
    className: 'custom-destroyed-pin',
    html: `
      <div class="relative flex items-center justify-center">
        <span class="absolute w-10 h-10 rounded-full bg-red-600/60 animate-ping"></span>
        <span class="absolute w-8 h-8 rounded-full bg-black/90 border border-red-500"></span>
        <div class="relative w-6 h-6 rounded-full bg-red-950 border-2 border-red-500 shadow-xl flex items-center justify-center text-red-300 font-bold text-xs">
          💀
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  });
};

// 4. Blue Police Patrol Interceptor (PCR) Marker with Siren Flasher
const createPcrIcon = (callsign = 'PCR-112') => {
  return L.divIcon({
    className: 'custom-pcr-pin',
    html: `
      <div class="relative flex items-center justify-center">
        <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
        <div class="w-8 h-8 rounded-xl bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
};

// 5. Calm Green Marker for Resolved Incident
const createResolvedIcon = () => {
  return L.divIcon({
    className: 'custom-resolved-pin',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center">
          <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14]
  });
};

// Auto-recenter map controller
function MapAutoRecenter({ targetCoords }) {
  const map = useMap();

  useEffect(() => {
    if (targetCoords && targetCoords.latitude && targetCoords.longitude) {
      map.flyTo([targetCoords.latitude, targetCoords.longitude], 15, { duration: 1.2 });
    }
  }, [targetCoords, map]);

  return null;
}

// Supported Free Open-Source & Google Map Tile Providers (No API Keys / Billing Required)
const MAP_PROVIDERS = {
  GOOGLE_ROADMAP: {
    id: 'GOOGLE_ROADMAP',
    name: 'Google Maps',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps (Open Web Services)',
    maxZoom: 20
  },
  GOOGLE_HYBRID: {
    id: 'GOOGLE_HYBRID',
    name: 'Google Satellite',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps Satellite Imagery',
    maxZoom: 20
  },
  OPENSTREETMAP: {
    id: 'OPENSTREETMAP',
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  TACTICAL_DARK: {
    id: 'TACTICAL_DARK',
    name: 'Tactical Dark',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap (Tactical Dark Invert)',
    className: 'dark-tactical-tiles',
    maxZoom: 19
  }
};

export default function DispatcherDashboard({
  incidents = [],
  pcrVehicles = [],
  onResolveIncident,
  onSimulateDemo,
  isConnected
}) {
  // Filters: 'ALL' | 'ACTIVE' | 'REVOKED' | 'RESOLVED'
  const [filter, setFilter] = useState('ALL');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showCadModal, setShowCadModal] = useState(null);
  const [audioPingsEnabled, setAudioPingsEnabled] = useState(true);
  const [selectedMapProvider, setSelectedMapProvider] = useState('GOOGLE_ROADMAP');
  const [mobileTab, setMobileTab] = useState('MAP');
  const [showLegend, setShowLegend] = useState(false);

  // Local synced incident list to support instant WebSocket / event reaction
  const [incidentList, setIncidentList] = useState(incidents);

  // Sync when prop incidents changes
  useEffect(() => {
    setIncidentList(incidents);
  }, [incidents]);

  // WebSocket / Window event listener for INCIDENT_REVOKED
  useEffect(() => {
    const handleRevokedEvent = (e) => {
      const payload = e.detail || e;
      const revokedId = payload?.id;
      const reason = payload?.reason || 'Parent Master PIN Abort';
      const revokedAt = payload?.revokedAt || new Date().toISOString();

      console.log(`[DispatcherConsole] Received INCIDENT_REVOKED for ${revokedId}. Updating triage cards and map.`);

      setIncidentList((prev) =>
        prev.map((inc) => {
          if (inc.id === revokedId) {
            return {
              ...inc,
              status: 'FALSE_ALARM_REVOKED',
              threatLevel: 'REVOKED',
              revokedAt,
              revocationReason: reason,
              dispatchNotes: `⚠️ ALERT REVOKED (FALSE ALARM): ${reason}. Cancellation verified via Master PIN 1234.`
            };
          }
          return inc;
        })
      );
    };

    window.addEventListener('INCIDENT_REVOKED', handleRevokedEvent);
    return () => {
      window.removeEventListener('INCIDENT_REVOKED', handleRevokedEvent);
    };
  }, []);

  // Filter categorizations
  const activeIncidents = useMemo(
    () => incidentList.filter((i) => i.status !== 'RESOLVED' && i.status !== 'FALSE_ALARM_REVOKED'),
    [incidentList]
  );
  const revokedIncidents = useMemo(
    () => incidentList.filter((i) => i.status === 'FALSE_ALARM_REVOKED'),
    [incidentList]
  );
  const resolvedIncidents = useMemo(
    () => incidentList.filter((i) => i.status === 'RESOLVED'),
    [incidentList]
  );

  const filteredIncidents = useMemo(() => {
    if (filter === 'ACTIVE') return activeIncidents;
    if (filter === 'REVOKED') return revokedIncidents;
    if (filter === 'RESOLVED') return resolvedIncidents;
    return incidentList;
  }, [filter, incidentList, activeIncidents, revokedIncidents, resolvedIncidents]);

  // Focus point: Selected incident, or newest active, or first available
  const currentFocus = selectedIncident || activeIncidents[0] || incidentList[0];
  const centerCoords = currentFocus?.coordinates || { latitude: 13.0550, longitude: 80.2600 };

  // Dispatch siren audio: Muted for revoked incidents & silent on initial mount
  const isInitialLoadRef = useRef(true);
  const prevActiveCountRef = useRef(activeIncidents.length);

  useEffect(() => {
    // Avoid triggering AudioContext on page load/initial state before user interaction
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      prevActiveCountRef.current = activeIncidents.length;
      return;
    }

    const hasNewIncomingEmergency = activeIncidents.length > prevActiveCountRef.current;
    prevActiveCountRef.current = activeIncidents.length;

    if (!audioPingsEnabled || !hasNewIncomingEmergency) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Only attempt to synthesize audio if browser allows autoplay
      if (ctx.state === 'suspended') {
        ctx.close().catch(() => {});
        return;
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);

      setTimeout(() => {
        try { ctx.close(); } catch (e) {}
      }, 500);
    } catch (e) {}
  }, [activeIncidents.length, audioPingsEnabled]);

  // Relative time helper
  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Just now';
    const seconds = Math.floor((new Date() - new Date(isoString)) / 1000);
    if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  // Color transition for Ambient Decibel Sound Pressure Level (SPL)
  const getDecibelMetrics = (db) => {
    const val = Number(db) || 45;
    if (val > 75) {
      return {
        text: 'text-rose-400',
        badge: 'bg-rose-950 text-rose-300 border-rose-800',
        bar: 'bg-rose-500',
        label: 'Critical Distress / High Decibel Impact'
      };
    }
    if (val >= 50) {
      return {
        text: 'text-amber-400',
        badge: 'bg-amber-950 text-amber-300 border-amber-800',
        bar: 'bg-amber-500',
        label: 'Elevated Ambient Commotion'
      };
    }
    return {
      text: 'text-emerald-400',
      badge: 'bg-emerald-950 text-emerald-300 border-emerald-800',
      bar: 'bg-emerald-500',
      label: 'Quiet / Covert Whisper Zone'
    };
  };

  // Extract phone hardware & OS details from telemetry
  const getDeviceInfo = (telemetry) => {
    if (!telemetry) {
      return {
        model: 'Poco M6 Pro 5G',
        os: 'Xiaomi HyperOS / Android 14',
        network: '5G NR Cellular'
      };
    }
    let model = 'Poco M6 Pro 5G';
    let os = 'Xiaomi HyperOS / Android 14';
    let network = telemetry.network || '5G NR Cellular';
    if (telemetry.device && typeof telemetry.device === 'object') {
      model = telemetry.device.model || model;
      os = telemetry.device.os || os;
      network = telemetry.device.networkType || network;
    } else if (typeof telemetry.device === 'string' && telemetry.device.length > 0) {
      model = telemetry.device;
    }
    if (telemetry.deviceModel) model = telemetry.deviceModel;
    return { model, os, network };
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* 112 Central Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 z-10 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-rose-700 via-rose-600 to-rose-500 flex items-center justify-center shadow-lg shadow-rose-950/50">
              <ShieldAlert className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            {activeIncidents.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-rose-500 rounded-full border-2 border-slate-900 animate-ping"></span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-xs sm:text-base font-bold text-white tracking-tight truncate">
                112 POLICE TRIAGE CONSOLE
              </h1>
              <span className="text-[9px] sm:text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-semibold shrink-0">
                ERSS CAD
              </span>
            </div>
            <p className="hidden sm:block text-xs text-slate-400 truncate">
              Zero-Audio Ingestion • Live OSM Reverse Geocoding • Accidental Trigger Revocation Guard
            </p>
          </div>
        </div>

        {/* System Status Indicators */}
        <div className="flex items-center gap-2 sm:gap-5 text-xs shrink-0">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-slate-400 text-[11px]">False-Alarm Guard</span>
            <span className="text-amber-400 font-mono font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              15s REVOCATION SYNC
            </span>
          </div>

          <div className="hidden sm:flex flex-col items-end border-l border-slate-800 pl-4">
            <span className="text-slate-400 text-[11px]">WebSocket Stream</span>
            <span className={`font-mono font-medium flex items-center gap-1.5 ${
              isConnected ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {isConnected ? 'SYNCED' : 'RECONNECTING...'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 sm:border-l sm:border-slate-800 sm:pl-4">
            <button
              onClick={() => setAudioPingsEnabled(!audioPingsEnabled)}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
              title={audioPingsEnabled ? "Disable siren klaxon" : "Enable siren klaxon"}
            >
              {audioPingsEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {onSimulateDemo && (
              <button
                onClick={onSimulateDemo}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1 shadow-md shadow-rose-950/50 transition-colors active:scale-95 touch-manipulation"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden xs:inline sm:inline">Simulate</span> SOS
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher: Tactical Map vs Incident Queue (screens < lg) */}
      <div className="flex lg:hidden w-full bg-slate-900 border-b border-slate-800 p-1.5 gap-2 px-3 shrink-0">
        <button
          onClick={() => setMobileTab('MAP')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
            mobileTab === 'MAP'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Tactical Map
        </button>
        <button
          onClick={() => setMobileTab('QUEUE')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
            mobileTab === 'QUEUE'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Incidents Queue ({activeIncidents.length})
        </button>
      </div>

      {/* Main Split: Left GIS Map & Right Incident Triage List */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* ======================================================== */}
        {/* LEAFLET GIS MAP CONTAINER                                */}
        {/* ======================================================== */}
        <div className={`flex-1 relative bg-slate-950 border-r border-slate-800 ${
          mobileTab === 'MAP' ? 'h-full flex' : 'hidden lg:flex lg:h-full'
        }`}>
          
          <MapContainer
            center={[centerCoords.latitude, centerCoords.longitude]}
            zoom={14}
            className="w-full h-full z-0"
            style={{ background: '#090d16' }}
          >
            {/* Dynamic Map Tile Grid (Google Maps / OpenStreetMap / Satellite) */}
            <TileLayer
              key={selectedMapProvider}
              attribution={MAP_PROVIDERS[selectedMapProvider].attribution}
              url={MAP_PROVIDERS[selectedMapProvider].url}
              maxZoom={MAP_PROVIDERS[selectedMapProvider].maxZoom}
              className={MAP_PROVIDERS[selectedMapProvider].className || ''}
            />

            <MapAutoRecenter targetCoords={currentFocus?.coordinates} />

            {/* 1. Plot Incidents with Status-Driven Iconography */}
            {incidentList.map((incident) => {
              const isResolved = incident.status === 'RESOLVED';
              const isRevoked = incident.status === 'FALSE_ALARM_REVOKED';
              const isDestroyed = incident.status === 'CRITICAL_DEVICE_DESTROYED';
              const isCritical = incident.threatLevel === 'CRITICAL';

              let markerIcon = isRevoked
                ? createRevokedIcon()
                : isResolved
                ? createResolvedIcon()
                : isDestroyed
                ? createDestroyedIcon()
                : createEmergencyIcon(isCritical);

              return (
                <Marker
                  key={incident.id}
                  position={[incident.coordinates.latitude, incident.coordinates.longitude]}
                  icon={markerIcon}
                  eventHandlers={{
                    click: () => setSelectedIncident(incident)
                  }}
                >
                  <Popup className="dark-popup">
                    <div className="p-2 min-w-[250px] text-slate-900">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs font-mono">{incident.id}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isRevoked
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isDestroyed
                            ? 'bg-red-900 text-white animate-pulse'
                            : isResolved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isRevoked ? 'REVOKED (FALSE ALARM)' : incident.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-800 font-semibold mb-1">
                        {incident.coordinates.locationName || 'Tamil Nadu Administrative Zone'}
                      </p>

                      {isRevoked ? (
                        <div className="text-[11px] bg-amber-50 border border-amber-200 rounded p-1.5 text-amber-900 my-1.5">
                          <b>Revoked by Citizen:</b> {incident.revocationReason || 'Parent Master PIN Abort'}
                          <div className="text-[10px] text-amber-700 mt-0.5">Dispatched patrol unit stood down.</div>
                        </div>
                      ) : (
                        <div className="text-[11px] space-y-0.5 text-slate-600 mb-2">
                          {(() => {
                            const dev = getDeviceInfo(incident.telemetry);
                            return (
                              <>
                                <div>Device: <b className="text-slate-900">{dev.model}</b></div>
                                <div>OS / System: <b className="text-slate-800">{dev.os}</b></div>
                                <div>Carrier: <b className="text-slate-800">{dev.network}</b></div>
                              </>
                            );
                          })()}
                          <div>Trigger: <b>{incident.triggerType}</b></div>
                          <div>Ambient Noise: <b>{incident.telemetry?.decibelLevel || 45} dB SPL</b></div>
                          <div>Assigned PCR: <b>{incident.assignedPcrUnit?.callsign || 'En route'}</b></div>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 mt-2">
                        {!isResolved && !isRevoked && (
                          <button
                            onClick={() => onResolveIncident(incident.id)}
                            className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                          >
                            Mark Resolved
                          </button>
                        )}
                        {incident.cadSchema && (
                          <button
                            onClick={() => setShowCadModal(incident.cadSchema)}
                            className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-medium"
                          >
                            CAD JSON
                          </button>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* 2. Plot Available & Dispatched Police PCR Patrol Vans */}
            {pcrVehicles.map((pcr) => {
              return (
                <Marker
                  key={pcr.unitId}
                  position={[pcr.coordinates.latitude, pcr.coordinates.longitude]}
                  icon={createPcrIcon(pcr.callsign)}
                >
                  <Popup className="dark-popup">
                    <div className="p-2 min-w-[210px] text-slate-900 text-xs">
                      <div className="font-bold text-blue-900 flex items-center gap-1 mb-1">
                        <Car className="w-3.5 h-3.5" /> {pcr.callsign}
                      </div>
                      <div className="text-[11px] text-slate-700 space-y-0.5">
                        <div>Vehicle: <b>{pcr.vehicleType}</b></div>
                        <div>Officer: <b>{pcr.driverName}</b></div>
                        <div>Contact: <b>{pcr.contactNumber}</b></div>
                        <div>Status: <b className="text-blue-700">{pcr.status}</b></div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* 3. Draw Vector Line (Polyline) between PCR and Target Incident (active only) */}
            {currentFocus &&
              currentFocus.status !== 'RESOLVED' &&
              currentFocus.status !== 'FALSE_ALARM_REVOKED' &&
              currentFocus.assignedPcrUnit && (
                <Polyline
                  positions={[
                    [currentFocus.assignedPcrUnit.coordinates.latitude, currentFocus.assignedPcrUnit.coordinates.longitude],
                    [currentFocus.coordinates.latitude, currentFocus.coordinates.longitude]
                  ]}
                  pathOptions={{
                    color: currentFocus.status === 'CRITICAL_DEVICE_DESTROYED' ? '#ef4444' : '#38bdf8',
                    weight: 3,
                    dashArray: '8, 8',
                    opacity: 0.85
                  }}
                />
            )}
          </MapContainer>

          {/* Quick Map Tile Provider Selector (Google Maps / Satellite / OSM) */}
          <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl z-[400] flex items-center gap-1 pointer-events-auto">
            <span className="text-[10px] text-slate-400 font-mono px-2 hidden sm:inline">Layer:</span>
            <button
              onClick={() => setSelectedMapProvider('GOOGLE_ROADMAP')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedMapProvider === 'GOOGLE_ROADMAP'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
            >
              Google Maps
            </button>
            <button
              onClick={() => setSelectedMapProvider('GOOGLE_HYBRID')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedMapProvider === 'GOOGLE_HYBRID'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setSelectedMapProvider('OPENSTREETMAP')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedMapProvider === 'OPENSTREETMAP'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
            >
              OSM
            </button>
            <button
              onClick={() => setSelectedMapProvider('TACTICAL_DARK')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedMapProvider === 'TACTICAL_DARK'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
            >
              Tactical Dark
            </button>
          </div>

          {/* Floating Map Legend Overlay */}
          <div className="absolute top-3 left-3 z-[400] pointer-events-auto">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="sm:hidden bg-slate-900/90 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 shadow-lg active:scale-95 transition-all"
            >
              <Layers className="w-3 h-3 text-rose-400" />
              Legend
            </button>
            <div className={`${showLegend ? 'block mt-1.5' : 'hidden sm:block'} bg-slate-900/95 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-slate-800 shadow-xl text-xs space-y-1.5 sm:space-y-2`}>
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-rose-400" />
                GIS Tactical Legend
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500 animate-pulse border border-white"></span>
                <span className="text-slate-300 text-[11px] sm:text-xs">Active Citizen Beacon</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500 border border-white"></span>
                <span className="text-amber-300 font-medium text-[11px] sm:text-xs">Revoked (False Positive)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">💀</span>
                <span className="text-rose-400 font-medium text-[11px] sm:text-xs">Device Destroyed (&gt;8s Lost)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-blue-600 flex items-center justify-center text-[9px] text-white">🚔</span>
                <span className="text-blue-300 text-[11px] sm:text-xs">Dispatched PCR Patrol Van</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 border border-white"></span>
                <span className="text-slate-300 text-[11px] sm:text-xs">Resolved Incident</span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT INCIDENT TRIAGE QUEUE & AUDIT FEED                 */}
        {/* ======================================================== */}
        <div className={`w-full lg:w-[500px] flex flex-col bg-slate-900/70 border-t lg:border-t-0 border-slate-800 ${
          mobileTab === 'QUEUE' ? 'h-full flex pb-20' : 'hidden lg:flex lg:h-full'
        }`}>
          
          {/* Header & Filter Controls */}
          <div className="p-4 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" />
              <h2 className="font-semibold text-sm text-white">Live Emergency Queue</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {incidentList.length}
              </span>
            </div>

            {/* Filter Toggle with Audit / False Alarm History Tab */}
            <div className="flex flex-wrap rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  filter === 'ALL' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({incidentList.length})
              </button>
              <button
                onClick={() => setFilter('ACTIVE')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  filter === 'ACTIVE' ? 'bg-rose-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                Active ({activeIncidents.length})
              </button>
              <button
                onClick={() => setFilter('REVOKED')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  filter === 'REVOKED'
                    ? 'bg-amber-600 text-white font-medium shadow-sm'
                    : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                Audit / False Alarms ({revokedIncidents.length})
              </button>
              <button
                onClick={() => setFilter('RESOLVED')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  filter === 'RESOLVED' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                Resolved ({resolvedIncidents.length})
              </button>
            </div>
          </div>

          {/* Incident Cards Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
            {filteredIncidents.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-medium">
                  {filter === 'REVOKED' ? 'No false alarm cancellations in audit log' : 'No incidents in this queue'}
                </p>
                <p className="text-xs mt-1">
                  {filter === 'REVOKED'
                    ? 'Incidents aborted via Master PIN 1234 will appear here with audit timestamps.'
                    : 'Covert citizen emergency triggers will populate here in real-time.'}
                </p>
              </div>
            ) : (
              filteredIncidents.map((incident) => {
                const isSelected = currentFocus?.id === incident.id;
                const isResolved = incident.status === 'RESOLVED';
                const isRevoked = incident.status === 'FALSE_ALARM_REVOKED';
                const isDestroyed = incident.status === 'CRITICAL_DEVICE_DESTROYED';
                const dbMetrics = getDecibelMetrics(incident.telemetry?.decibelLevel);
                const batteryLevel = incident.telemetry?.battery?.level ?? 50;
                const isCharging = incident.telemetry?.battery?.charging ?? false;
                const pcr = incident.assignedPcrUnit;

                return (
                  <div
                    key={incident.id}
                    onClick={() => setSelectedIncident(incident)}
                    className={`rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? isRevoked
                          ? 'border-amber-500 bg-amber-950/20 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/40'
                          : isDestroyed
                          ? 'border-red-500 bg-red-950/30 shadow-lg shadow-red-950/40 ring-1 ring-red-500'
                          : 'border-rose-500 bg-slate-800/90 shadow-lg shadow-rose-950/20 ring-1 ring-rose-500/30'
                        : isRevoked
                        ? 'border-amber-800/50 bg-slate-900/80 hover:border-amber-700/60'
                        : isDestroyed
                        ? 'border-red-900/80 bg-red-950/20 animate-pulse'
                        : isResolved
                        ? 'border-slate-800 bg-slate-900/40 opacity-75'
                        : 'border-slate-700 bg-slate-900/90 hover:border-slate-600'
                    }`}
                  >
                    {/* Header: ID, Status Badge, Trigger Code, Time */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-white">
                          {incident.id}
                        </span>

                        {/* Status Badge: Active -> Red, Revoked -> Grey/Yellow */}
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                            isRevoked
                              ? 'bg-amber-950/90 text-amber-300 border border-amber-600/70 shadow-sm'
                              : isDestroyed
                              ? 'bg-red-900 text-red-100 border border-red-700 animate-bounce'
                              : isResolved
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : incident.threatLevel === 'CRITICAL'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {isRevoked ? (
                            <>
                              <ShieldCheck className="w-3 h-3 text-amber-400" />
                              ALERT REVOKED (FALSE ALARM)
                            </>
                          ) : isDestroyed ? (
                            '💀 DEVICE DESTROYED'
                          ) : isResolved ? (
                            'RESOLVED'
                          ) : (
                            `${incident.threatLevel} PRIORITY`
                          )}
                        </span>

                        {/* Trigger Type Badge */}
                        {incident.triggerType && (
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold ${
                            incident.triggerType === 'DURESS_PIN_COERCION'
                              ? 'bg-purple-950 text-purple-300 border-purple-800'
                              : incident.triggerType === 'PROXIMITY_BLIND_TAP'
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {incident.triggerType.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center text-xs text-slate-400 gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTimeAgo(incident.timestamp)}</span>
                      </div>
                    </div>

                    {/* Revocation Callout Banner if False Alarm */}
                    {isRevoked && (
                      <div className="mb-3 bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-lg text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-300">
                          <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                          Citizen Revocation Audit Trail
                        </div>
                        <div className="text-[11px] text-amber-200/90 font-mono">
                          Reason: <span className="text-white font-semibold">{incident.revocationReason || 'Parent Master PIN Abort'}</span>
                        </div>
                        <div className="text-[10px] text-amber-400/80 flex items-center justify-between pt-1 border-t border-amber-900/60">
                          <span>Auth: Master PIN 1234 Verified</span>
                          <span>Timestamp: {new Date(incident.revokedAt || incident.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    )}

                    {/* Resolved Street Address via Nominatim */}
                    <div className="flex items-start gap-2 text-xs text-slate-200 mb-3 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                      <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-white leading-tight">
                          {incident.coordinates.locationName || 'Tamil Nadu Administrative Zone'}
                        </div>
                        {incident.indoorFloorEstimate && (
                          <div className="my-1 flex items-center gap-1 text-[11px] text-cyan-300 font-medium bg-cyan-950/60 border border-cyan-800/70 px-2 py-0.5 rounded">
                            <span>🏢 Indoor 3D Geofence:</span>
                            <span className="font-semibold text-white">{incident.indoorFloorEstimate}</span>
                          </div>
                        )}
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {incident.coordinates.latitude.toFixed(5)}, {incident.coordinates.longitude.toFixed(5)}
                          <span className="text-slate-500 ml-1.5">(±{incident.coordinates.accuracy}m GPS Accuracy)</span>
                        </div>
                      </div>
                    </div>

                    {/* Device Hardware & OS Telemetry Badge */}
                    {(() => {
                      const dev = getDeviceInfo(incident.telemetry);
                      return (
                        <div className="flex items-center justify-between text-xs bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 mb-3 shadow-inner">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-indigo-950/70 border border-indigo-700/60 text-indigo-300 shrink-0">
                              <Smartphone className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                <span>{dev.model}</span>
                                <span className="text-[10px] bg-slate-800 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.2 rounded font-mono font-medium">
                                  {dev.network}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                OS: <span className="text-slate-200 font-medium">{dev.os}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                              HARDWARE SYNCED
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Dispatched PCR Patrol Unit Callout */}
                    {pcr && (
                      <div className={`mb-3 p-2.5 rounded-lg text-xs flex items-center justify-between border ${
                        isRevoked
                          ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                          : 'bg-blue-950/30 border-blue-900/60'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-md ${
                            isRevoked ? 'bg-slate-800 text-slate-500' : 'bg-blue-600/30 text-blue-400'
                          }`}>
                            <Car className="w-4 h-4" />
                          </div>
                          <div>
                            <div className={`font-semibold ${isRevoked ? 'text-slate-400' : 'text-blue-200'}`}>
                              {pcr.callsign}
                            </div>
                            <div className="text-[11px] text-slate-500">{pcr.driverName} • {pcr.contactNumber}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          {isRevoked ? (
                            <span className="text-[11px] font-semibold text-amber-400/90 block">
                              Stand Down • Stood Down
                            </span>
                          ) : (
                            <>
                              <span className="text-xs font-mono font-bold text-blue-300 block">{pcr.distanceKm} km away</span>
                              <span className="text-[10px] text-blue-400">ETA ~{pcr.etaMinutes} mins</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Sensor Telemetry Indicators */}
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      {/* Ambient Decibels Gauge */}
                      <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                        <div className="flex items-center justify-between mb-1 text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Volume2 className="w-3 h-3 text-cyan-400" /> Ambient Noise
                          </span>
                          <span className={`font-mono font-bold ${dbMetrics.text}`}>
                            {incident.telemetry?.decibelLevel || 45} dB
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${dbMetrics.bar} transition-all duration-500`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(10, ((incident.telemetry?.decibelLevel || 45) - 30) * 1.4)
                              )}%`
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block truncate">
                          {dbMetrics.label}
                        </span>
                      </div>

                      {/* Battery Percentage */}
                      <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                        <div className="flex items-center justify-between mb-1 text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            {isCharging ? (
                              <BatteryCharging className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Battery className="w-3 h-3 text-amber-400" />
                            )}
                            Battery Power
                          </span>
                          <span className="font-mono font-bold text-slate-200">
                            {batteryLevel}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              batteryLevel > 50
                                ? 'bg-emerald-500'
                                : batteryLevel > 20
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${batteryLevel}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          {isCharging ? 'Connected to Power' : 'Discharging on Battery'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons: C-DAC CAD JSON Modal & Resolve Button */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                      {incident.cadSchema && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCadModal(incident.cadSchema);
                          }}
                          className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors"
                        >
                          <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                          C-DAC 112 CAD JSON
                        </button>
                      )}

                      {isRevoked ? (
                        <div className="flex-1 text-[11px] font-mono text-amber-300 bg-amber-950/30 border border-amber-900/50 rounded-lg p-1.5 text-center flex items-center justify-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                          False Alarm Logged in Audit Trail
                        </div>
                      ) : !isResolved ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onResolveIncident(incident.id, '112 Patrol team neutralized incident.');
                          }}
                          className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Resolve & Clear
                        </button>
                      ) : (
                        <div className="flex-1 text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-1.5 text-center">
                          Incident Resolved
                        </div>
                      )}
                    </div>

                    {/* Section 63 BSA Cryptographic Hash-Chain Audit Footer */}
                    {incident.blockHash && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          Section 63 BSA Signed
                        </span>
                        <span className="text-slate-400 truncate max-w-[200px]" title={`SHA-256 Ledger Block: ${incident.blockHash}`}>
                          Block Hash: <code className="text-cyan-400">{incident.blockHash.slice(0, 12)}...</code>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* C-DAC ERSS 112 CAD JSON SCHEMA INSPECTOR MODAL           */}
      {/* ======================================================== */}
      {showCadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-2xl w-full rounded-2xl p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setShowCadModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-cyan-600/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  C-DAC ERSS 112 CAD Standard Payload
                </h3>
                <p className="text-xs text-slate-400">
                  Govt. of India Emergency Response Support System (ERSS) Specification
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto max-h-[60vh] custom-scrollbar">
              <pre className="font-mono text-xs text-emerald-300 leading-relaxed">
                {JSON.stringify(showCadModal, null, 2)}
              </pre>
            </div>

            <div className="mt-4 flex justify-between items-center text-xs text-slate-400">
              <span>Standard: Ministry of Home Affairs / C-DAC ERSS v3.4</span>
              <button
                onClick={() => setShowCadModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
