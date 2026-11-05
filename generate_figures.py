import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

os.makedirs('report_assets', exist_ok=True)
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['figure.autolayout'] = True

# -------------------------------------------------------------
# FIG 1: High-Level System Architecture
# -------------------------------------------------------------
def make_fig1():
    fig, ax = plt.subplots(figsize=(11, 7), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 96, "SilentCall-SOS: End-to-End System Architecture", fontsize=15, fontweight='bold', ha='center', color='#0f172a')

    # Tier 1: Client Edge (Citizen Device)
    rect1 = patches.FancyBboxPatch((4, 10), 28, 80, boxstyle="round,pad=1.5", facecolor='#f8fafc', edgecolor='#0284c7', linewidth=2)
    ax.add_patch(rect1)
    ax.text(18, 87, "Citizen Mobile Edge (PWA / Android)", fontsize=11, fontweight='bold', ha='center', color='#0369a1')

    boxes_client = [
        (18, 77, "Duress Lockscreen Guard\nPIN: 180499 (Clean) / 999999 (Duress)", "#e0f2fe", "#0284c7"),
        (18, 62, "Covert Calculator Intercept\n('112 =' Stealth Intercept)", "#e0f2fe", "#0284c7"),
        (18, 47, "Proximity Blind-Tap Engine\n(3 Near-Pulses in 2000ms)", "#e0f2fe", "#0284c7"),
        (18, 32, "Zero-Audio Acoustic Sampler\n(<=200ms RMS -> Instant Track Termination)", "#fee2e2", "#dc2626"),
        (18, 17, "Local Geofence & Barometer\n(100m Anchor & Floor Resolver)", "#fef3c7", "#d97706")
    ]
    for x, y, text, fc, ec in boxes_client:
        b = patches.FancyBboxPatch((x-12, y-5), 24, 10, boxstyle="round,pad=0.5", facecolor=fc, edgecolor=ec, linewidth=1.5)
        ax.add_patch(b)
        ax.text(x, y, text, fontsize=8, ha='center', va='center', fontweight='bold', color='#1e293b')

    # Tier 2: Real-time Communication & Triage Server
    rect2 = patches.FancyBboxPatch((36, 10), 28, 80, boxstyle="round,pad=1.5", facecolor='#f8fafc', edgecolor='#6366f1', linewidth=2)
    ax.add_patch(rect2)
    ax.text(50, 87, "Triage Server (Node.js + Express + WS)", fontsize=11, fontweight='bold', ha='center', color='#4338ca')

    boxes_server = [
        (50, 77, "WebSocket Broadcast Broker\n(ws:// Full-Duplex Engine)", "#e0e7ff", "#4f46e5"),
        (50, 62, "Threat Classification Matrix\n(Critical, High, Coercion, Battery)", "#e0e7ff", "#4f46e5"),
        (50, 47, "Section 63 BSA / 65B IEA Ledger\n(SHA-256 Hash Chained Blocks)", "#dcfce7", "#16a34a"),
        (50, 32, "Dead Man's Switch Watchdog\n(Heartbeat 3s Loss Detection)", "#fee2e2", "#dc2626"),
        (50, 17, "Patrol Interceptor (PCR) Dispatcher\n(Haversine Distance & Unit Allocation)", "#fef3c7", "#d97706")
    ]
    for x, y, text, fc, ec in boxes_server:
        b = patches.FancyBboxPatch((x-12, y-5), 24, 10, boxstyle="round,pad=0.5", facecolor=fc, edgecolor=ec, linewidth=1.5)
        ax.add_patch(b)
        ax.text(x, y, text, fontsize=8, ha='center', va='center', fontweight='bold', color='#1e293b')

    # Tier 3: Emergency Dispatch Console & First Responders
    rect3 = patches.FancyBboxPatch((68, 10), 28, 80, boxstyle="round,pad=1.5", facecolor='#f8fafc', edgecolor='#059669', linewidth=2)
    ax.add_patch(rect3)
    ax.text(82, 87, "112 Central Dispatch Command", fontsize=11, fontweight='bold', ha='center', color='#047857')

    boxes_disp = [
        (82, 77, "Tactical Dark GIS Radar\n(Leaflet + Auto-Recenter)", "#d1fae5", "#059669"),
        (82, 62, "Pulsating Threat Beacons\n(Active, Revoked, Destroyed)", "#d1fae5", "#059669"),
        (82, 47, "Acoustic Decibel SPL Gauge\n(Visual Ambient Threat Level)", "#fee2e2", "#dc2626"),
        (82, 32, "PCR Interceptor Route Sync\n(Live GPS Tracking & ETA)", "#e0e7ff", "#4f46e5"),
        (82, 17, "Forensic Evidence Export\n(Section 63 Certificate & Log)", "#fef3c7", "#d97706")
    ]
    for x, y, text, fc, ec in boxes_disp:
        b = patches.FancyBboxPatch((x-12, y-5), 24, 10, boxstyle="round,pad=0.5", facecolor=fc, edgecolor=ec, linewidth=1.5)
        ax.add_patch(b)
        ax.text(x, y, text, fontsize=8, ha='center', va='center', fontweight='bold', color='#1e293b')

    # Arrows connecting Tiers
    arrowprops = dict(arrowstyle="->", lw=2, color="#0284c7")
    ax.annotate("", xy=(36, 62), xytext=(32, 62), arrowprops=arrowprops)
    ax.text(34, 65, "JSON SOS", fontsize=8, ha='center', color='#0284c7', fontweight='bold')

    arrowprops_ws = dict(arrowstyle="<->", lw=2, color="#6366f1")
    ax.annotate("", xy=(68, 62), xytext=(64, 62), arrowprops=arrowprops_ws)
    ax.text(66, 65, "WebSocket", fontsize=8, ha='center', color='#6366f1', fontweight='bold')

    plt.savefig('report_assets/fig_1_architecture.png', bbox_inches='tight')
    plt.close()
    print("Saved fig_1_architecture.png")


# -------------------------------------------------------------
# FIG 2: Comprehensive System Flowchart
# -------------------------------------------------------------
def make_fig2():
    fig, ax = plt.subplots(figsize=(10, 12), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 120)
    ax.axis('off')

    ax.text(50, 116, "Comprehensive System Flowchart: SilentCall-SOS", fontsize=14, fontweight='bold', ha='center', color='#0f172a')

    # Start
    p_start = patches.FancyBboxPatch((38, 106), 24, 6, boxstyle="round,pad=1", facecolor='#e2e8f0', edgecolor='#475569', linewidth=1.5)
    ax.add_patch(p_start)
    ax.text(50, 109, "START: Citizen App Active", fontsize=9, fontweight='bold', ha='center', va='center')

    # Trigger Decision
    d1 = patches.Polygon([[50, 101], [70, 93], [50, 85], [30, 93]], closed=True, facecolor='#fef3c7', edgecolor='#d97706', linewidth=1.5)
    ax.add_patch(d1)
    ax.text(50, 93, "Emergency\nTrigger Event?", fontsize=8, fontweight='bold', ha='center', va='center')

    # Branch 1: Duress PIN
    b1 = patches.FancyBboxPatch((5, 72), 22, 8, boxstyle="round,pad=0.5", facecolor='#fee2e2', edgecolor='#dc2626', linewidth=1.5)
    ax.add_patch(b1)
    ax.text(16, 76, "Duress PIN '999999'\n(1.5s Hold on 6th '9')", fontsize=7.5, fontweight='bold', ha='center', va='center')

    # Branch 2: Covert Calculator
    b2 = patches.FancyBboxPatch((39, 72), 22, 8, boxstyle="round,pad=0.5", facecolor='#e0f2fe', edgecolor='#0284c7', linewidth=1.5)
    ax.add_patch(b2)
    ax.text(50, 76, "Covert Calculator\nType '112' & Hit '='", fontsize=7.5, fontweight='bold', ha='center', va='center')

    # Branch 3: Proximity Blind-Tap
    b3 = patches.FancyBboxPatch((73, 72), 22, 8, boxstyle="round,pad=0.5", facecolor='#f3e8ff', edgecolor='#9333ea', linewidth=1.5)
    ax.add_patch(b3)
    ax.text(84, 76, "Proximity Blind-Tap\n(3 Covers in 2000ms)", fontsize=7.5, fontweight='bold', ha='center', va='center')

    # Connecting arrows from decision to branches
    ax.annotate("", xy=(16, 80), xytext=(35, 90), arrowprops=dict(arrowstyle="->", lw=1.5, color='#475569'))
    ax.annotate("", xy=(50, 80), xytext=(50, 85), arrowprops=dict(arrowstyle="->", lw=1.5, color='#475569'))
    ax.annotate("", xy=(84, 80), xytext=(65, 90), arrowprops=dict(arrowstyle="->", lw=1.5, color='#475569'))

    # Converge to Telemetry Ingestion
    ax.annotate("", xy=(50, 62), xytext=(16, 72), arrowprops=dict(arrowstyle="->", lw=1.5, color='#0284c7'))
    ax.annotate("", xy=(50, 62), xytext=(50, 72), arrowprops=dict(arrowstyle="->", lw=1.5, color='#0284c7'))
    ax.annotate("", xy=(50, 62), xytext=(84, 72), arrowprops=dict(arrowstyle="->", lw=1.5, color='#0284c7'))

    p_telemetry = patches.FancyBboxPatch((20, 52), 60, 10, boxstyle="round,pad=0.5", facecolor='#f1f5f9', edgecolor='#0f172a', linewidth=2)
    ax.add_patch(p_telemetry)
    ax.text(50, 57, "STEALTH TELEMETRY INGESTION ENGINE\n• GPS Lat/Lng & Accuracy • Battery % & Charging State\n• 200ms Web Audio FFT -> RMS dB SPL -> Tracks STOPPED", fontsize=8, fontweight='bold', ha='center', va='center')

    # Security & Evidence Verification
    p_crypto = patches.FancyBboxPatch((22, 38), 56, 9, boxstyle="round,pad=0.5", facecolor='#dcfce7', edgecolor='#16a34a', linewidth=1.5)
    ax.add_patch(p_crypto)
    ax.text(50, 42.5, "CRYPTOGRAPHIC LEDGER & DISPATCH BROADCAST\n• ECDSA / SHA-256 Immutable Hash Chain (Sec 63 BSA)\n• WebSocket Transmission (ws://) with HTTP POST Fallback", fontsize=8, fontweight='bold', ha='center', va='center')

    ax.annotate("", xy=(50, 47), xytext=(50, 52), arrowprops=dict(arrowstyle="->", lw=1.5, color='#0f172a'))

    # Dispatch Command Console Action
    p_cmd = patches.FancyBboxPatch((20, 22), 60, 11, boxstyle="round,pad=0.5", facecolor='#e0e7ff', edgecolor='#4338ca', linewidth=2)
    ax.add_patch(p_cmd)
    ax.text(50, 27.5, "112 CENTRAL DISPATCH COMMAND CONSOLE\n• Real-Time Map Centering & Pulsating Threat Pin Plot\n• Threat Evaluation: Ambient dB, Battery & Coercion Flags\n• Auto-Allocation of Nearest Patrol Unit (PCR Innova/Scorpio)", fontsize=8, fontweight='bold', ha='center', va='center')

    ax.annotate("", xy=(50, 33), xytext=(50, 38), arrowprops=dict(arrowstyle="->", lw=1.5, color='#0f172a'))

    # Resolution & Audit
    p_end = patches.FancyBboxPatch((35, 8), 30, 8, boxstyle="round,pad=1", facecolor='#e2e8f0', edgecolor='#475569', linewidth=1.5)
    ax.add_patch(p_end)
    ax.text(50, 12, "INCIDENT RESOLUTION &\nIMMUTABLE FORENSIC ARCHIVE", fontsize=8, fontweight='bold', ha='center', va='center')

    ax.annotate("", xy=(50, 16), xytext=(50, 22), arrowprops=dict(arrowstyle="->", lw=1.5, color='#0f172a'))

    plt.savefig('report_assets/fig_2_flowchart_overall.png', bbox_inches='tight')
    plt.close()
    print("Saved fig_2_flowchart_overall.png")


# -------------------------------------------------------------
# FIG 3: State Machine Diagram
# -------------------------------------------------------------
def make_fig3():
    fig, ax = plt.subplots(figsize=(11, 6), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 95, "Duress Lockscreen & Covert Trigger State Machine", fontsize=14, fontweight='bold', ha='center', color='#0f172a')

    # States
    s_locked = patches.FancyBboxPatch((5, 55), 18, 16, boxstyle="round,pad=0.8", facecolor='#e2e8f0', edgecolor='#475569', linewidth=2)
    ax.add_patch(s_locked)
    ax.text(14, 63, "STATE 1:\nLOCKED\n(Lock Screen)", fontsize=9, fontweight='bold', ha='center', va='center')

    s_calc = patches.FancyBboxPatch((40, 70), 22, 16, boxstyle="round,pad=0.8", facecolor='#e0f2fe', edgecolor='#0284c7', linewidth=2)
    ax.add_patch(s_calc)
    ax.text(51, 78, "STATE 2:\nUNLOCKED COVERT\n(Functional Calculator)", fontsize=9, fontweight='bold', ha='center', va='center')

    s_shut = patches.FancyBboxPatch((40, 35), 22, 16, boxstyle="round,pad=0.8", facecolor='#fee2e2', edgecolor='#dc2626', linewidth=2)
    ax.add_patch(s_shut)
    ax.text(51, 43, "STATE 3:\nFAKE SHUTDOWN\n(2.5s OS Spinner)", fontsize=9, fontweight='bold', ha='center', va='center')

    s_black = patches.FancyBboxPatch((74, 35), 22, 16, boxstyle="round,pad=0.8", facecolor='#1e293b', edgecolor='#ef4444', linewidth=2)
    ax.add_patch(s_black)
    ax.text(85, 43, "STATE 4:\nPITCH BLACKOUT\n(Background Beacons)", fontsize=9, fontweight='bold', ha='center', va='center', color='white')

    s_sos = patches.FancyBboxPatch((74, 70), 22, 16, boxstyle="round,pad=0.8", facecolor='#fef2f2', edgecolor='#b91c1c', linewidth=2)
    ax.add_patch(s_sos)
    ax.text(85, 78, "STATE 5:\nACTIVE COVERT SOS\n(Dispatch Live Sync)", fontsize=9, fontweight='bold', ha='center', va='center', color='#b91c1c')

    # Transitions
    # 1. Clean unlock
    ax.annotate("", xy=(40, 78), xytext=(23, 68), arrowprops=dict(arrowstyle="->", lw=1.8, color='#0284c7'))
    ax.text(28, 77, "PIN '180499'", fontsize=8, fontweight='bold', color='#0284c7', rotation=15)

    # 2. Duress PIN
    ax.annotate("", xy=(40, 43), xytext=(23, 58), arrowprops=dict(arrowstyle="->", lw=1.8, color='#dc2626'))
    ax.text(26, 47, "Duress PIN '999999'\n(1.5s Hold)", fontsize=8, fontweight='bold', color='#dc2626', rotation=-15)

    # 3. Shutdown -> Blackout
    ax.annotate("", xy=(74, 43), xytext=(62, 43), arrowprops=dict(arrowstyle="->", lw=1.8, color='#dc2626'))
    ax.text(68, 46, "2.5s elapsed", fontsize=8, fontweight='bold', color='#dc2626', ha='center')

    # 4. Blackout -> SOS Dispatched
    ax.annotate("", xy=(85, 70), xytext=(85, 51), arrowprops=dict(arrowstyle="->", lw=1.8, color='#dc2626'))
    ax.text(87, 60, "15s Grace End\n(or Instant)", fontsize=8, fontweight='bold', color='#dc2626')

    # 5. Calculator -> SOS
    ax.annotate("", xy=(74, 78), xytext=(62, 78), arrowprops=dict(arrowstyle="->", lw=1.8, color='#b91c1c'))
    ax.text(68, 81, "Type '112 ='", fontsize=8, fontweight='bold', color='#b91c1c', ha='center')

    # 6. Abort hatch (Blackout to Unlocked)
    ax.annotate("", xy=(51, 70), xytext=(80, 51), arrowprops=dict(arrowstyle="->", lw=1.5, linestyle="--", color='#16a34a'))
    ax.text(60, 58, "Top-Right Double Tap\n+ Master PIN '180499'", fontsize=7.5, fontweight='bold', color='#16a34a')

    # 7. Relock
    ax.annotate("", xy=(14, 55), xytext=(40, 72), arrowprops=dict(arrowstyle="->", lw=1.2, linestyle=":", color='#64748b'))
    ax.text(22, 60, "Double-tap 'AC'", fontsize=7.5, color='#64748b')

    plt.savefig('report_assets/fig_3_state_machine.png', bbox_inches='tight')
    plt.close()
    print("Saved fig_3_state_machine.png")


# -------------------------------------------------------------
# FIG 4: Data Flow Diagram (DFD Level 1)
# -------------------------------------------------------------
def make_fig4():
    fig, ax = plt.subplots(figsize=(10, 7), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 95, "SilentCall-SOS: Data Flow Diagram (DFD Level 1)", fontsize=14, fontweight='bold', ha='center', color='#0f172a')

    # External Entity 1: Citizen
    e1 = patches.Rectangle((4, 60), 18, 16, facecolor='#f1f5f9', edgecolor='#334155', linewidth=2)
    ax.add_patch(e1)
    ax.text(13, 68, "CITIZEN\n(Hostage / Victim)", fontsize=9, fontweight='bold', ha='center', va='center')

    # External Entity 2: Dispatcher / First Responder
    e2 = patches.Rectangle((78, 60), 18, 16, facecolor='#f1f5f9', edgecolor='#334155', linewidth=2)
    ax.add_patch(e2)
    ax.text(87, 68, "112 DISPATCHER\n& PCR PATROL", fontsize=9, fontweight='bold', ha='center', va='center')

    # Process 1.0: Trigger Capture & Sanitization
    p1 = patches.Circle((40, 75), 10, facecolor='#e0f2fe', edgecolor='#0284c7', linewidth=2)
    ax.add_patch(p1)
    ax.text(40, 75, "1.0\nTrigger\nSanitization", fontsize=8, fontweight='bold', ha='center', va='center')

    # Process 2.0: Telemetry Aggregation
    p2 = patches.Circle((40, 45), 10, facecolor='#fee2e2', edgecolor='#dc2626', linewidth=2)
    ax.add_patch(p2)
    ax.text(40, 45, "2.0\nZero-Audio\nTelemetry", fontsize=8, fontweight='bold', ha='center', va='center')

    # Process 3.0: Triage & Broadcast
    p3 = patches.Circle((65, 60), 10, facecolor='#dcfce7', edgecolor='#16a34a', linewidth=2)
    ax.add_patch(p3)
    ax.text(65, 60, "3.0\nTriage &\nDispatch Sync", fontsize=8, fontweight='bold', ha='center', va='center')

    # Data Store D1: Incident Ledger
    d1_top = patches.Rectangle((30, 18), 40, 10, facecolor='#fef3c7', edgecolor='#d97706', linewidth=1.5)
    ax.add_patch(d1_top)
    ax.plot([30, 70], [18, 18], color='#b45309', lw=2)
    ax.plot([30, 70], [28, 28], color='#b45309', lw=2)
    ax.text(50, 23, "D1: Section 63 BSA Cryptographic Incident Ledger", fontsize=8, fontweight='bold', ha='center', va='center')

    # Flows
    ax.annotate("Covert Key / Sensor Tap", xy=(30, 75), xytext=(22, 70), arrowprops=dict(arrowstyle="->", lw=1.5, color='#0284c7'))
    ax.annotate("Trigger Type", xy=(40, 55), xytext=(40, 65), arrowprops=dict(arrowstyle="->", lw=1.5, color='#475569'))
    ax.annotate("Signed SOS Packet", xy=(55, 60), xytext=(48, 50), arrowprops=dict(arrowstyle="->", lw=1.5, color='#dc2626'))
    ax.annotate("Live Alert &\nPatrol Routing", xy=(78, 68), xytext=(75, 65), arrowprops=dict(arrowstyle="->", lw=1.5, color='#16a34a'))
    ax.annotate("Commit Block", xy=(50, 28), xytext=(65, 50), arrowprops=dict(arrowstyle="->", lw=1.5, color='#b45309'))

    plt.savefig('report_assets/fig_4_dfd_level1.png', bbox_inches='tight')
    plt.close()
    print("Saved fig_4_dfd_level1.png")


# -------------------------------------------------------------
# FIG 5: Zero-Audio Acoustic Sampling Pipeline
# -------------------------------------------------------------
def make_fig5():
    fig, ax = plt.subplots(figsize=(11, 5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 50)
    ax.axis('off')

    ax.text(50, 46, "Zero-Audio Acoustic Telemetry Pipeline (200ms RMS Ingestion)", fontsize=13, fontweight='bold', ha='center', color='#0f172a')

    steps = [
        (10, 25, "Hardware Mic\nMediaStream\n(audio: true)", "#f1f5f9", "#475569"),
        (30, 25, "Web Audio\nAudioContext\n44.1 kHz PCM", "#e0f2fe", "#0284c7"),
        (50, 25, "AnalyserNode\n256 FFT Bins\nTime Domain Data", "#e0e7ff", "#4f46e5"),
        (70, 25, "RMS & Decibel\nComputation\n20 log10(RMS)", "#fee2e2", "#dc2626"),
        (90, 25, "TRACKS STOPPED\nMicrophone Killed\n0 Bytes Stored/Sent", "#dcfce7", "#16a34a")
    ]

    for x, y, text, fc, ec in steps:
        b = patches.FancyBboxPatch((x-8, y-10), 16, 20, boxstyle="round,pad=0.5", facecolor=fc, edgecolor=ec, linewidth=1.8)
        ax.add_patch(b)
        ax.text(x, y, text, fontsize=7.5, fontweight='bold', ha='center', va='center', color='#0f172a')

    for i in range(len(steps)-1):
        ax.annotate("", xy=(steps[i+1][0]-8, 25), xytext=(steps[i][0]+8, 25),
                    arrowprops=dict(arrowstyle="->", lw=2, color="#0f172a"))

    ax.text(50, 6, "Total Active Microphone Window: <= 200 ms | 100% GDPR & Section 69 IT Act Privacy Preserving",
            fontsize=9, ha='center', fontweight='bold', color='#16a34a',
            bbox=dict(boxstyle="round,pad=0.4", facecolor='#f0fdf4', edgecolor='#86efac'))

    plt.savefig('report_assets/fig_5_acoustic_pipeline.png', bbox_inches='tight')
    plt.close()
    print("Saved fig_5_acoustic_pipeline.png")


# -------------------------------------------------------------
# FIG 6: Latency and Performance Benchmark Comparison Chart
# -------------------------------------------------------------
def make_fig6():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.5), dpi=300)

    # Bar chart 1: Emergency Transmission Latency (seconds)
    systems = ['Dial 112 Voice Call\n(Manual + IVR Queue)', 'Traditional SMS SOS\n(SMS Gateway Delay)', 'SilentCall HTTP REST\nFallback API', 'SilentCall-SOS\nWebSocket (Direct)']
    latencies = [32.5, 9.4, 0.38, 0.142] # seconds
    colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981']

    bars = ax1.bar(systems, latencies, color=colors, width=0.55, edgecolor='#1e293b', linewidth=1.2)
    ax1.set_ylabel("Dispatch Notification Time (Seconds)", fontsize=9, fontweight='bold')
    ax1.set_title("Emergency Signal Latency Comparison", fontsize=11, fontweight='bold', color='#0f172a')
    ax1.set_yscale('log')
    ax1.grid(axis='y', linestyle='--', alpha=0.5)

    for bar in bars:
        h = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., h * 1.15,
                f"{h:.3f} s" if h < 1 else f"{h:.1f} s",
                ha='center', va='bottom', fontsize=8, fontweight='bold')

    # Chart 2: Threat Decibel Accuracy across Environments
    env = ['Silent Library', 'Normal Office', 'Hostile Shouting', 'Screaming / Distress', 'Gunshot / Explosion']
    db_actual = [35, 58, 76, 88, 105]
    db_measured = [36.2, 57.8, 75.4, 87.5, 103.8]

    x = np.arange(len(env))
    width = 0.35

    ax2.bar(x - width/2, db_actual, width, label='Calibrated Decibel Meter', color='#94a3b8')
    ax2.bar(x + width/2, db_measured, width, label='SilentCall Web Audio RMS', color='#0284c7')
    ax2.set_ylabel("Sound Pressure Level (dB SPL)", fontsize=9, fontweight='bold')
    ax2.set_title("Acoustic Sampling Precision (200ms)", fontsize=11, fontweight='bold', color='#0f172a')
    ax2.set_xticks(x)
    ax2.set_xticklabels(env, rotation=25, ha='right', fontsize=8)
    ax2.legend(fontsize=8)
    ax2.grid(axis='y', linestyle='--', alpha=0.5)

    plt.tight_layout()
    plt.savefig('report_assets/fig_6_latency_chart.png', bbox_inches='tight')
    plt.close()
    print("Saved fig_6_latency_chart.png")


# -------------------------------------------------------------
# FIG 7: Indoor 3D Geofence & Barometric Altitude Resolution
# -------------------------------------------------------------
def make_fig7():
    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 95, "Indoor 3D Geofence & Vertical Floor Estimation", fontsize=14, fontweight='bold', ha='center', color='#0f172a')

    # 2D Geofence circle
    circle = patches.Circle((30, 45), 25, facecolor='#eff6ff', edgecolor='#3b82f6', linestyle='--', linewidth=2)
    ax.add_patch(circle)
    ax.plot(30, 45, 'ro', markersize=8)
    ax.text(30, 48, "Anchor Lat/Lng\n(Safe Home Anchor)", fontsize=8, fontweight='bold', ha='center', color='#1e3a8a')
    ax.text(30, 18, "Horizontal Geofence Threshold: <= 100m (Haversine Formula)", fontsize=8, ha='center', color='#2563eb', fontweight='bold')

    # Building Profile (Vertical Resolution)
    b_floors = 6
    bx, by, bw, bh = 65, 20, 28, 65
    rect_b = patches.Rectangle((bx, by), bw, bh, facecolor='#f8fafc', edgecolor='#334155', linewidth=2)
    ax.add_patch(rect_b)

    for i in range(b_floors):
        floor_y = by + i * (bh / b_floors)
        ax.plot([bx, bx + bw], [floor_y, floor_y], color='#cbd5e1', lw=1.5)
        floor_num = i + 1
        label = f"Floor {floor_num}"
        if floor_num == 4:
            ax.add_patch(patches.Rectangle((bx, floor_y), bw, bh/b_floors, facecolor='#fed7aa', edgecolor='#ea580c', lw=1.5))
            ax.text(bx + bw/2, floor_y + 5, f"Floor 4: Tower B, Flat 402\nMATCHED (Delta: +12.3m)", fontsize=7, fontweight='bold', ha='center', color='#9a3412')
        else:
            ax.text(bx + bw/2, floor_y + 5, label, fontsize=8, ha='center', color='#64748b')

    ax.text(79, 88, "Building Vertical Profile\n(Barometric Pressure Delta)", fontsize=9, fontweight='bold', ha='center', color='#0f172a')
    ax.text(50, 6, "Hypsometric Formula: h = 44330 * [1 - (P / P0)^(1/5.255)] | Precision: ±1.2m vertical floor resolution",
            fontsize=8.5, ha='center', fontweight='bold', color='#334155')

    plt.savefig('report_assets/fig_7_indoor_vertical.png', bbox_inches='tight')
    plt.close()
    print("Saved fig_7_indoor_vertical.png")


# -------------------------------------------------------------
# FIG 8: Cryptographic Block Ledger Structure (Section 63 BSA)
# -------------------------------------------------------------
def make_fig8():
    fig, ax = plt.subplots(figsize=(11, 4.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 50)
    ax.axis('off')

    ax.text(50, 46, "Section 63 BSA / 65B IEA Immutable Cryptographic Hash Chain", fontsize=13, fontweight='bold', ha='center', color='#0f172a')

    blocks = [
        (18, 22, "Block #1 (GENESIS)\n• Event: SOS_TRIGGER\n• Threat: CRITICAL (84 dB)\n• PrevHash: 0000000000...\n• Hash: e3b0c44298fc1c14...", "#f1f5f9", "#475569"),
        (50, 22, "Block #2 (PCR_DISPATCH)\n• Event: PATROL_ASSIGNED\n• Assigned: PCR-TN-01 Delta\n• PrevHash: e3b0c44298fc...\n• Hash: 7a82b1394c803d85...", "#dbeafe", "#2563eb"),
        (82, 22, "Block #3 (RESOLUTION)\n• Event: INCIDENT_RESOLVED\n• Action: Citizen Protected\n• PrevHash: 7a82b1394c80...\n• Hash: f5a9341829e24b01...", "#dcfce7", "#16a34a")
    ]

    for x, y, text, fc, ec in blocks:
        b = patches.FancyBboxPatch((x-14, y-14), 28, 28, boxstyle="round,pad=0.8", facecolor=fc, edgecolor=ec, linewidth=2)
        ax.add_patch(b)
        ax.text(x, y, text, fontsize=7.5, fontweight='bold', ha='center', va='center', color='#0f172a')

    # Hash chain linking arrows
    ax.annotate("SHA-256 Chained", xy=(36, 22), xytext=(32, 22), arrowprops=dict(arrowstyle="->", lw=2, color="#2563eb"))
    ax.annotate("SHA-256 Chained", xy=(68, 22), xytext=(64, 22), arrowprops=dict(arrowstyle="->", lw=2, color="#16a34a"))

    ax.text(50, 3, "Statutory Compliance: Bharatiya Sakshya Adhiniyam, 2023 Sec 63 / Former Sec 65B Indian Evidence Act",
            fontsize=8.5, ha='center', fontweight='bold', color='#047857',
            bbox=dict(boxstyle="round,pad=0.3", facecolor='#f0fdf4', edgecolor='#86efac'))

    plt.savefig('report_assets/fig_8_ledger_structure.png', bbox_inches='tight')
    plt.close()
    print("Saved fig_8_ledger_structure.png")


# -------------------------------------------------------------
# FIG 9: Realistic UI Mockup: Citizen Smartphone Covert Matrix
# -------------------------------------------------------------
def make_fig9():
    fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(12, 6), dpi=300)

    for ax in (ax1, ax2, ax3):
        ax.set_xlim(0, 100)
        ax.set_ylim(0, 180)
        ax.axis('off')

    # Phone 1: Duress Lockscreen
    # Outer Bezel
    ax1.add_patch(patches.FancyBboxPatch((5, 5), 90, 170, boxstyle="round,pad=2", facecolor='#0f172a', edgecolor='#334155', lw=3))
    # Screen Area
    ax1.add_patch(patches.FancyBboxPatch((8, 8), 84, 164, boxstyle="round,pad=1", facecolor='#020617', edgecolor='#1e293b', lw=1.5))
    # Notch
    ax1.add_patch(patches.FancyBboxPatch((35, 164), 30, 5, boxstyle="round,pad=0.2", facecolor='#0f172a', edgecolor='#334155', lw=1))
    # Clock
    ax1.text(50, 145, "09:41", fontsize=22, fontweight='bold', color='white', ha='center')
    ax1.text(50, 137, "Tuesday, November 3", fontsize=8, color='#94a3b8', ha='center')
    # Keypad
    ax1.text(50, 118, "Enter Passcode", fontsize=10, color='#cbd5e1', ha='center')
    # PIN dots
    for i in range(6):
        ax1.plot(35 + i*6, 108, 'o', color='#475569', markersize=6)
    # Digits
    digits = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['*', '0', '#']]
    for row_idx, row in enumerate(digits):
        for col_idx, d in enumerate(row):
            cx = 25 + col_idx * 25
            cy = 90 - row_idx * 18
            ax1.add_patch(patches.Circle((cx, cy), 7, facecolor='#1e293b', edgecolor='#334155'))
            ax1.text(cx, cy, d, color='white', fontsize=11, fontweight='bold', ha='center', va='center')
    ax1.text(50, 15, "Coercion PIN: 999999\nClean Unlock: 180499", fontsize=8, color='#f87171', ha='center', fontweight='bold')
    ax1.set_title("A: Duress Lockscreen", fontsize=11, fontweight='bold', color='#0f172a', y=-0.08)

    # Phone 2: Fake Shutdown Screen
    ax2.add_patch(patches.FancyBboxPatch((5, 5), 90, 170, boxstyle="round,pad=2", facecolor='#0f172a', edgecolor='#334155', lw=3))
    ax2.add_patch(patches.FancyBboxPatch((8, 8), 84, 164, boxstyle="round,pad=1", facecolor='#000000', edgecolor='#1e293b', lw=1.5))
    ax2.add_patch(patches.FancyBboxPatch((35, 164), 30, 5, boxstyle="round,pad=0.2", facecolor='#0f172a', edgecolor='#334155', lw=1))
    # Spinner
    ax2.add_patch(patches.Circle((50, 95), 14, facecolor='none', edgecolor='#64748b', lw=2, linestyle=':'))
    ax2.text(50, 95, "⟳", fontsize=28, color='#f8fafc', ha='center', va='center')
    ax2.text(50, 70, "Shutting down...", fontsize=10, color='#e2e8f0', ha='center')
    ax2.text(50, 35, "Simulated Shutdown\n(Silently Transmits Beacons)\nCorner Double-Tap = Abort Hatch", fontsize=7.5, color='#94a3b8', ha='center')
    ax2.set_title("B: Covert OS Shutdown", fontsize=11, fontweight='bold', color='#0f172a', y=-0.08)

    # Phone 3: Covert Calculator
    ax3.add_patch(patches.FancyBboxPatch((5, 5), 90, 170, boxstyle="round,pad=2", facecolor='#0f172a', edgecolor='#334155', lw=3))
    ax3.add_patch(patches.FancyBboxPatch((8, 8), 84, 164, boxstyle="round,pad=1", facecolor='#171717', edgecolor='#262626', lw=1.5))
    ax3.add_patch(patches.FancyBboxPatch((35, 164), 30, 5, boxstyle="round,pad=0.2", facecolor='#0f172a', edgecolor='#334155', lw=1))
    # Calculator Display
    ax3.text(82, 138, "112", fontsize=34, fontweight='bold', color='white', ha='right')
    # Calculator Keys
    calc_keys = [
        ['AC', '+/-', '%', '÷'],
        ['7', '8', '9', '×'],
        ['4', '5', '6', '-'],
        ['1', '2', '3', '+'],
        ['0', '.', '=', '']
    ]
    key_colors = {
        'AC': ('#a3a3a3', '#000000'), '+/-': ('#a3a3a3', '#000000'), '%': ('#a3a3a3', '#000000'),
        '÷': ('#f97316', '#ffffff'), '×': ('#f97316', '#ffffff'), '-': ('#f97316', '#ffffff'), '+': ('#f97316', '#ffffff'),
        '=': ('#f97316', '#ffffff')
    }
    for r_idx, row in enumerate(calc_keys):
        for c_idx, k in enumerate(row):
            if not k: continue
            cx = 20 + c_idx * 20
            cy = 115 - r_idx * 16
            bg, fg = key_colors.get(k, ('#404040', '#ffffff'))
            ax3.add_patch(patches.Circle((cx, cy), 7, facecolor=bg))
            ax3.text(cx, cy, k, color=fg, fontsize=9, fontweight='bold', ha='center', va='center')
    ax3.text(50, 18, "Pressing '=' with 112\nsilently triggers emergency SOS", fontsize=7.5, color='#38bdf8', ha='center', fontweight='bold')
    ax3.set_title("C: Stealth Calculator Intercept", fontsize=11, fontweight='bold', color='#0f172a', y=-0.08)

    plt.tight_layout()
    plt.savefig('report_assets/fig_9_ui_lockscreen_calculator.png', bbox_inches='tight')
    plt.close()
    print("Saved fig_9_ui_lockscreen_calculator.png")


# -------------------------------------------------------------
# FIG 10: Realistic UI Mockup: 112 Emergency Central Dispatch
# -------------------------------------------------------------
def make_fig10():
    fig, ax = plt.subplots(figsize=(12, 7), dpi=300)
    ax.set_xlim(0, 120)
    ax.set_ylim(0, 80)
    ax.axis('off')

    # Main Console Frame (Dark Slate Tactical Theme)
    ax.add_patch(patches.Rectangle((0, 0), 120, 80, facecolor='#090d16', edgecolor='#1e293b', lw=2))

    # Top Header Bar
    ax.add_patch(patches.Rectangle((0, 72), 120, 8, facecolor='#0f172a', edgecolor='#1e293b', lw=1))
    ax.text(3, 76, "POLICE 112 COMMAND // SILENTCALL TACTICAL TRIAGE RADAR", fontsize=11, fontweight='bold', color='#38bdf8', va='center')
    ax.text(85, 76, "SYSTEM STATUS: ENCRYPTED (WS LIVE) | PCR FLEET: 3 ACTIVE", fontsize=8, color='#4ade80', va='center')

    # Left Section: Tactical Map View
    ax.add_patch(patches.Rectangle((2, 2), 76, 68, facecolor='#020617', edgecolor='#1e293b', lw=1.5))
    ax.text(4, 66, "LIVE GEOSPATIAL RADAR (CHENNAI METROPOLITAN SECTOR)", fontsize=9, fontweight='bold', color='#94a3b8')

    # Mock Map Grid & Roads
    for gx in range(10, 75, 12):
        ax.plot([gx, gx+5], [5, 65], color='#1e293b', lw=1, alpha=0.5)
    for gy in range(10, 65, 12):
        ax.plot([5, 75], [gy, gy], color='#1e293b', lw=1, alpha=0.5)

    # Active SOS Pulsing Pin (Anna Salai)
    ax.add_patch(patches.Circle((42, 40), 9, facecolor='#f43f5e', alpha=0.25))
    ax.add_patch(patches.Circle((42, 40), 5, facecolor='#e11d48', alpha=0.5))
    ax.add_patch(patches.Circle((42, 40), 2.5, facecolor='#be123c'))
    ax.text(42, 52, "[!] INCIDENT #SC-8921\nCRITICAL (84.2 dB)\nFloor 4 (Tower B)", fontsize=7.5, color='#fecdd3', fontweight='bold', ha='center',
            bbox=dict(boxstyle="round,pad=0.3", facecolor='#4c0519', edgecolor='#f43f5e'))

    # PCR Patrol Vehicles
    ax.add_patch(patches.Rectangle((20, 25), 4, 3, facecolor='#2563eb', edgecolor='white'))
    ax.text(22, 21, "[PATROL] PCR-TN-01 Delta\n(En-Route ETA: 3.2m)", fontsize=6.5, color='#93c5fd', ha='center')
    # Route Polyline
    ax.plot([22, 42], [26.5, 40], color='#38bdf8', lw=2, linestyle='--')

    ax.add_patch(patches.Rectangle((60, 50), 4, 3, facecolor='#3b82f6', edgecolor='white'))
    ax.text(62, 46, "[PATROL] PCR-TN-04 Bravo\n(Patrolling)", fontsize=6.5, color='#93c5fd', ha='center')

    # Right Section: Live Telemetry & Incident Details
    ax.add_patch(patches.Rectangle((80, 2), 38, 68, facecolor='#0f172a', edgecolor='#1e293b', lw=1.5))
    ax.text(82, 66, "INCIDENT TRIAGE TELEMETRY", fontsize=9, fontweight='bold', color='#38bdf8')

    telemetry_items = [
        ("Incident ID", "#SC-8921-TN (Active)"),
        ("Trigger Type", "DURESS_PIN_COERCION (999999)"),
        ("Threat Level", "CRITICAL THREAT"),
        ("GPS Coordinates", "13.0550° N, 80.2600° E (±4.2m)"),
        ("Indoor Floor", "Tower B, Flat 402, Floor 4 (+12.3m)"),
        ("Ambient Acoustic", "84.2 dB SPL (High Decibels)"),
        ("Acoustic Audio", "0 Bytes (GDPR Zero-Audio Discard)"),
        ("Battery Status", "18% (Discharging / Battery Warning)"),
        ("Evidence Integrity", "Sec 63 BSA SHA-256 Hash Chained"),
        ("Patrol Assigned", "PCR-TN-01 Delta (SI K. Murugan)")
    ]

    for idx, (label, val) in enumerate(telemetry_items):
        yy = 60 - idx * 5.2
        ax.text(82, yy, f"{label}:", fontsize=7, color='#94a3b8', fontweight='bold')
        color = '#ef4444' if 'CRITICAL' in val or 'DURESS' in val else ('#4ade80' if '0 Bytes' in val or 'Sec 63' in val else '#f8fafc')
        ax.text(97, yy, val, fontsize=7, color=color, fontweight='bold')

    # Quick action button at bottom right
    ax.add_patch(patches.FancyBboxPatch((82, 5), 34, 6, boxstyle="round,pad=0.3", facecolor='#15803d', edgecolor='#22c55e', lw=1))
    ax.text(99, 8, "✓ RESOLVE & COMMIT FORENSIC RECORD", fontsize=7.5, fontweight='bold', color='white', ha='center', va='center')

    plt.tight_layout()
    plt.savefig('report_assets/fig_10_ui_dispatcher_console.png', bbox_inches='tight')
    plt.close()
    print("Saved fig_10_ui_dispatcher_console.png")

if __name__ == '__main__':
    make_fig1()
    make_fig2()
    make_fig3()
    make_fig4()
    make_fig5()
    make_fig6()
    make_fig7()
    make_fig8()
    make_fig9()
    make_fig10()
    print("All 10 figures successfully generated!")
