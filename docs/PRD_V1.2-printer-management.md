# InkNeighbour --- Product Requirements Document

## Printer Management Platform

  Document attribute     Details
  ---------------------- -------------------------------------------
  Product                InkNeighbour
  Document version       1.2
  Date                   16 November 2026
  Status                 Proposed --- Product Baseline
  Product category       Printing Marketplace & Printer Management
  Primary USP            Printer Management
  Initial connectivity   Windows Desktop Agent
  AI Intelligence        Deferred --- Not in active scope

------------------------------------------------------------------------

# 1. Executive Summary

InkNeighbour is evolving from a neighbourhood printing marketplace into
a broader printing ecosystem.

The product will bring together two core capabilities:

1.  **Print Marketplace:** Connect customers with neighbourhood printing
    service providers.
2.  **Printer Management:** Allow individuals, households and businesses
    to connect, monitor and manage their physical printers.

Printer management will become one of InkNeighbour's primary
differentiators.

Unlike conventional printing marketplaces, InkNeighbour will allow users
to manage their own printers even if they never offer printing services
through the marketplace.

Marketplace participation will be optional.

The product will initially focus on reliable printer connectivity,
device monitoring, consumable tracking, alerts and print execution.

AI-based intelligence is deliberately deferred. The platform will
collect and retain useful operational data so that intelligence
capabilities can be introduced in a future product phase without
redesigning the core system.

**Product vision:** Make printer ownership and printing operations
simpler, more visible and easier to manage.

**Product positioning:** More than printing. Your printer, intelligently
managed.

The word "intelligently" describes the product experience and does not
imply that AI functionality is included in the initial releases.

**Core product promise: Connect. Monitor. Manage. Print.**

# 2. Product Objectives

## 2.1 Primary objectives

-   Allow users to connect physical printers to InkNeighbour.
-   Provide a centralised view of registered printers.
-   Monitor printer availability and operational status.
-   Monitor ink, toner and other consumables where supported.
-   Notify users about low supplies and printer errors.
-   Maintain printer usage and operational history.
-   Enable printing through registered local printers.
-   Support multiple printers per account.
-   Integrate registered printers with existing marketplace workflows.

## 2.2 Business objectives

-   Differentiate InkNeighbour through printer management.
-   Acquire personal printer owners independently of marketplace
    participation.
-   Increase user engagement through ongoing printer monitoring.
-   Create subscription opportunities for advanced device and business
    management.
-   Improve marketplace provider operational efficiency.
-   Build a foundation for future product intelligence.

## 2.3 Non-objectives

The current implementation will not:

-   Build AI or predictive intelligence features.
-   Integrate LLMs or external AI APIs.
-   Develop an AI recommendation engine.
-   Build AI-specific infrastructure or subscriptions.
-   Guarantee compatibility with every printer.
-   Replace manufacturer printer-management applications.
-   Develop printer firmware or manufacturer-specific drivers.
-   Build a complete enterprise print-management platform.
-   Support every operating system in the initial release.

# 3. Target Users

## 3.1 Personal printer owners

Individuals and households who own one or more printers.

**Requirements:** - Register personal printers. - View printer
availability. - Monitor ink and toner levels. - Receive supply and error
alerts. - Track printing activity. - Print documents through registered
printers.

Marketplace registration is not required.

## 3.2 Home-based printing providers

Individuals who offer printing services from their homes.

**Requirements:** - Manage multiple printers. - Monitor device
availability. - Receive customer printing orders. - Assign jobs to
registered printers. - Track printing activity. - Monitor consumables. -
Manage printing operations.

## 3.3 Small businesses

Businesses operating printers across one or more locations.

**Requirements:** - Centralised printer management. - Multiple devices
and locations. - Operational monitoring. - Consumable tracking. -
Printing activity history. - User access management.

## 3.4 Print shops

Professional printing service providers.

**Requirements:** - Manage a printer fleet. - Route customer jobs. -
Track job execution. - Monitor device availability. - Maintain printing
history. - Track operational usage.

# 4. Product Structure

InkNeighbour will have four logical product areas, with three in active
implementation.

  Product area              Scope
  ------------------------- ---------------------
  Marketplace               Active
  Printer Management        Active --- Core USP
  Print Execution           Active
  Print Intelligence / AI   Deferred

## 4.1 Proposed application navigation

-   Dashboard
-   Marketplace
-   My Printers
-   Print Jobs
-   Supplies
-   Analytics
-   Account Settings

The navigation must be integrated into the existing React application.
Existing routes and workflows must be preserved.

## 4.2 Account model

A user can operate in one or more contexts:

-   Personal account.
-   Business account.
-   Existing marketplace provider account.

The same authenticated user should be able to manage personal and
business printers without creating separate InkNeighbour logins.

A personal printer account must not require an existing marketplace
owner record.

Marketplace association must remain optional.

# 5. Functional Requirements

## 5.1 Printer Discovery and Registration

**Priority: P0 --- Critical**

Users must be able to discover and register printers through
InkNeighbour Connect, the Windows desktop agent.

### Functional requirements

-   Download the Windows agent from InkNeighbour.
-   Install the agent on a Windows computer.
-   Pair the agent with an authenticated InkNeighbour account.
-   Discover locally connected USB printers.
-   Discover supported network printers.
-   Display discovered printers.
-   Select printers for registration.
-   Associate printers with an account.
-   Associate printers with an optional location.
-   Rename registered printers.
-   Remove or disconnect printers.
-   Display agent connectivity status.
-   Prevent duplicate registration of the same physical device within an
    account where reliable identification is possible.

### Printer information

-   Manufacturer.
-   Model.
-   Device identifier.
-   Connection type.
-   IP address, where applicable.
-   Driver information.
-   Supported capabilities.
-   Current operational status.
-   Last communication timestamp.

### Acceptance criteria

1.  An authenticated user can pair a Windows installation.
2.  The agent discovers supported USB and network printers.
3.  The user explicitly selects printers for registration.
4.  Registered printers appear in the InkNeighbour dashboard.
5.  Printer ownership is scoped to the correct account.
6.  Removing or revoking an agent prevents further authorised
    communication.
7.  Users can manage multiple registered printers.

## 5.2 Printer Dashboard

**Priority: P0 --- Critical**

The dashboard provides a consolidated view of registered printers.

### Required information

-   Printer name.
-   Manufacturer and model.
-   Online/offline status.
-   Ready/busy/error state where available.
-   Ink and toner levels where supported.
-   Paper status where available.
-   Last communication timestamp.
-   Recent print activity.
-   Open alerts.

### Filters

-   All printers.
-   Online.
-   Offline.
-   Attention required.
-   Low supplies.

### Acceptance criteria

-   Users can view all printers belonging to their account.
-   Device status is updated from agent telemetry.
-   Offline devices are identified.
-   Stale readings are visibly identified.
-   Unsupported information is not displayed as a false zero or healthy
    state.

## 5.3 Consumables Monitoring

**Priority: P0 --- Critical**

Consumables monitoring is a major product differentiator.

### Functional requirements

-   Read ink and toner information where supported.
-   Track supported consumable types.
-   Store historical readings.
-   Display current readings.
-   Display reading timestamps.
-   Identify low-supply conditions.
-   Support configurable alert thresholds.
-   Allow manual supply-level entry when automatic reporting is
    unavailable.
-   Maintain the source and reliability classification of each reading.

### Reading classifications

  Classification   Definition
  ---------------- -----------------------------------------
  Actual           Directly reported by the printer
  Estimated        Calculated from recorded usage
  Manual           Entered by the user
  Unsupported      Printer does not expose the information

Estimation may be used for basic operational display only where its
limitations are clearly explained. No predictive AI forecasting is
included.

### Alerts

-   Black ink running low.
-   Colour ink running low.
-   Toner running low.
-   Consumable replacement required.
-   Consumable information unavailable.
-   Consumable reading is outdated.

### Acceptance criteria

-   Users can view supported consumable levels.
-   Every reading includes a source and timestamp.
-   Low-supply alerts respect configured thresholds.
-   Unsupported readings are clearly identified.
-   Historical readings are retained.

## 5.4 Printer Status and Error Monitoring

**Priority: P0 --- Critical**

### Functional requirements

Monitor:

-   Printer online/offline state.
-   Ready/busy state where available.
-   Printer error state.
-   Paper-related errors where exposed.
-   Connection failures.
-   Agent heartbeat.
-   Communication failures.

### User-facing diagnostics

Provide basic explanations and troubleshooting instructions based on
available device information.

Example:

**Printer offline**

Possible causes: - Printer powered off. - Network connectivity lost. -
USB cable disconnected. - Windows print service unavailable.

The application must distinguish observed errors from possible causes.

### Acceptance criteria

-   Status changes are recorded.
-   Offline printers are identified.
-   Agent failures are distinguishable from printer failures.
-   Error events are retained in operational history.

## 5.5 Print Job Management

**Priority: P1 --- High**

InkNeighbour must support printing through registered printers.

### Personal printing

-   Upload supported documents.
-   Select a registered printer.
-   Configure supported print settings.
-   Submit a print job.
-   Monitor job progress.
-   View job history.
-   Cancel jobs where supported.

### Marketplace printing

-   Preserve the existing customer order flow.
-   Allow providers to associate printers with their marketplace
    service.
-   Allow providers to assign accepted jobs to registered printers.
-   Deliver authorised print commands to the Windows agent.
-   Record execution events.
-   Provide failure and retry workflows.

### Print job states

-   Submitted.
-   Queued.
-   Downloading.
-   Printing.
-   Completed.
-   Failed.
-   Cancelled.
-   Unknown.

### Important operational distinction

A Windows spooler completion event does not prove that physical pages
were successfully printed.

InkNeighbour must report the strongest available execution state without
claiming physical completion when it cannot verify it.

### Acceptance criteria

-   An authorised user can submit a print job.
-   The selected registered printer receives the job.
-   Job status is recorded.
-   Failed jobs can be investigated.
-   Cross-account document and job access is prevented.

## 5.6 Printing History and Analytics

**Priority: P1 --- High**

### Functional requirements

Maintain:

-   Total pages printed where available.
-   Printing activity over time.
-   Black-and-white and colour usage where available.
-   Printer utilisation.
-   Consumable readings and changes.
-   Estimated printing costs.
-   Job success and failure statistics.

Cost estimates must use documented assumptions such as paper cost,
cartridge cost and available page counts.

Analytics must distinguish measured data from calculated values.

## 5.7 Notifications and Alerts

**Priority: P1 --- High**

### Alert types

-   Printer offline.
-   Printer error.
-   Low ink.
-   Low toner.
-   Agent disconnected.
-   Print job failed.
-   Consumable information unavailable.

### Notification channels

Initial implementation:

-   In-app notifications.
-   Email notifications where configured.

Additional channels can be evaluated later.

Users should be able to configure notification preferences and
acknowledge alerts.

# 6. InkNeighbour Connect --- Windows Agent

**Priority: Core Platform Dependency**

InkNeighbour Connect is the desktop component responsible for
communication with locally accessible printers.

## 6.1 Technology

Proposed implementation:

-   .NET Worker Service.
-   Windows Service.
-   Separate Windows tray application.
-   Windows Print Spooler integration.
-   Windows printer APIs.
-   IPP/IPPS where supported.
-   SNMP for compatible network printers.
-   mDNS/DNS-SD for network discovery where supported.

## 6.2 Agent responsibilities

-   Discover local printers.
-   Collect printer information.
-   Report supported capabilities.
-   Register printers.
-   Collect telemetry.
-   Report agent heartbeat.
-   Retrieve authorised print jobs.
-   Execute print jobs.
-   Report job status.
-   Handle connectivity interruptions.
-   Maintain secure authentication.

## 6.3 Connectivity

Initial communication model:

1.  Agent authenticates with InkNeighbour.
2.  Agent sends periodic heartbeat and telemetry.
3.  Agent retrieves authorised commands over HTTPS.
4.  Agent executes permitted operations locally.
5.  Agent reports execution results.

The initial implementation should use a simple outbound communication
model.

Persistent real-time connections can be evaluated if polling creates
measurable latency or operational problems.

## 6.4 Security

-   Outbound HTTPS communication.
-   No public inbound printer ports.
-   Device-specific credentials.
-   Windows DPAPI or Credential Manager for credential protection.
-   Agent revocation.
-   Signed installers and updates.
-   Command validation.
-   Minimal required privileges.
-   Secure document handling.

The agent must never accept arbitrary shell commands from the cloud.

## 6.5 Compatibility model

Printer support must be capability-based.

  Capability        Example
  ----------------- -------------------------
  Discovery         USB / Network
  Status            Ready / Busy / Error
  Ink levels        Actual / Unsupported
  Toner levels      Actual / Unsupported
  Page counters     Supported / Unsupported
  Print execution   Supported / Unsupported
  Error reporting   Detailed / Limited

The product must maintain a tested compatibility matrix.

# 7. Technical Architecture

## 7.1 Existing application stack

The integration must respect the current InkNeighbour repository.

  Layer               Technology
  ------------------- ----------------------------------------
  Frontend            React 18
  Build tooling       Vite 5
  Routing             React Router 6
  Styling             Tailwind CSS 3
  Backend platform    Supabase
  Database            PostgreSQL
  Authentication      Supabase Auth
  File storage        Supabase Storage
  Server-side logic   Supabase Edge Functions
  Realtime            Supabase Realtime
  Hosting             Vercel
  Testing             Vitest and React Testing Library
  Desktop agent       .NET Worker Service + Windows tray app

No frontend framework migration is required.

No separate ASP.NET Core backend is required for the initial
implementation.

## 7.2 Logical architecture

React PWA\
↓\
Supabase Auth and PostgreSQL\
↓\
Supabase Edge Functions\
↓\
Secure agent communication\
↓\
InkNeighbour Connect\
↓\
Windows printer subsystem and supported network printers

The existing marketplace continues to use its established data model and
workflows.

## 7.3 Backend principles

-   Reuse existing Supabase authentication.
-   Keep printer data account-scoped.
-   Enforce Row Level Security.
-   Keep agent operations behind server-side validation.
-   Do not expose service-role credentials to the frontend or agent.
-   Use private document storage.
-   Use short-lived signed URLs.
-   Validate device commands.
-   Maintain operational audit records.
-   Preserve historical telemetry.

# 8. Proposed Database Design

The following is a proposed additive model. Final table names,
relationships and migration scripts must be reconciled with the actual
repository migrations.

## 8.1 Core entities

### printer_accounts

Represents the personal or business context in which printers are
managed.

  Field          Purpose
  -------------- ---------------------
  id             Primary key
  account_type   personal / business
  name           Account name
  created_by     Supabase user
  created_at     Creation timestamp

### printer_account_members

Supports shared business printer management.

  Field        Purpose
  ------------ ------------------------
  id           Primary key
  account_id   Printer account
  user_id      Supabase user
  role         owner / admin / member
  created_at   Creation timestamp

### printer_agents

  Field               Purpose
  ------------------- ----------------------------
  id                  Agent identifier
  account_id          Associated account
  device_name         Windows device name
  agent_version       Installed version
  status              online / offline / revoked
  last_heartbeat_at   Last heartbeat
  paired_at           Pairing timestamp

### printers

  Field                  Purpose
  ---------------------- -------------------------------
  id                     Printer identifier
  account_id             Owning account
  agent_id               Associated agent
  marketplace_owner_id   Optional marketplace provider
  location_id            Optional location
  name                   User-defined name
  manufacturer           Manufacturer
  model                  Model
  connection_type        USB / network
  device_identifier      Stable device identifier
  capabilities           Supported capabilities
  status                 Current status
  last_seen_at           Last communication
  created_at             Registration timestamp

### printer_metrics

Stores historical readings and operational telemetry.

  Field          Purpose
  -------------- -----------------------------
  id             Metric identifier
  printer_id     Printer
  metric_type    Status / page count / other
  metric_value   Recorded value
  source         Actual / estimated / manual
  recorded_at    Reading timestamp

### printer_consumables

  Field              Purpose
  ------------------ -----------------------------------------
  id                 Consumable identifier
  printer_id         Printer
  consumable_type    Ink / toner / other
  colour             Black / cyan / magenta / yellow / other
  level_percentage   Reading
  source             Actual / estimated / manual
  observed_at        Reading timestamp

### printer_alerts

  Field        Purpose
  ------------ --------------------------------
  id           Alert identifier
  account_id   Account
  printer_id   Printer
  alert_type   Low ink / offline / error
  severity     Info / warning / critical
  message      User-facing message
  status       Open / acknowledged / resolved
  created_at   Creation timestamp

### printer_jobs

  Field                Purpose
  -------------------- ---------------------------------
  id                   Print job identifier
  account_id           Account
  printer_id           Selected printer
  marketplace_job_id   Optional existing job reference
  document_id          Stored document reference
  job_status           Current status
  settings             Validated print settings
  submitted_at         Submission time
  completed_at         Completion time

### printer_job_events

  Field            Purpose
  ---------------- ----------------------------------------
  id               Event identifier
  printer_job_id   Associated job
  event_type       Queued / printing / completed / failed
  details          Event metadata
  created_at       Event timestamp

### printer_locations

  Field         Purpose
  ------------- ----------------------
  id            Location identifier
  account_id    Account
  name          Location name
  description   Optional description

## 8.2 Data design principles

-   Every printer belongs to a printer account.
-   Marketplace association is optional.
-   Personal users do not require an owners record.
-   Multiple printers can belong to an account.
-   Multiple agents may serve an account.
-   Printer ownership is separate from agent connectivity.
-   Existing marketplace jobs remain valid.
-   Historical metrics are retained according to an explicit retention
    policy.
-   Telemetry records include source, timestamp and measurement context.
-   No AI-specific tables or services are required.

# 9. API and Agent Contracts

Device operations must be validated server-side.

Proposed logical operations:

  Operation                   Purpose
  --------------------------- -----------------------------
  pair-agent                  Register Windows agent
  agent-heartbeat             Update agent status
  register-printer            Register discovered printer
  update-printer-status       Report printer state
  submit-printer-metrics      Send telemetry
  submit-consumable-reading   Report supply readings
  fetch-pending-jobs          Retrieve authorised jobs
  update-job-status           Report execution progress
  revoke-agent                Revoke an agent

These operations may be implemented as Supabase Edge Functions.

## 9.1 Example telemetry payload

``` json
{
  "printer_id": "printer-uuid",
  "observed_at": "2026-11-16T09:30:00Z",
  "status": "ready",
  "connection": "network",
  "consumables": [
    {
      "type": "ink",
      "colour": "black",
      "level": 35,
      "source": "actual"
    }
  ]
}
```

## 9.2 Example print job command

``` json
{
  "job_id": "job-uuid",
  "printer_id": "printer-uuid",
  "document_url": "short-lived-signed-url",
  "settings": {
    "copies": 1,
    "colour_mode": "monochrome",
    "duplex": false
  }
}
```

The agent must validate job identity, printer association, document
access and supported print settings before execution.

# 10. Security and Privacy

Security is a release requirement.

-   Enforce RLS on account-scoped tables.
-   Authenticate agents independently.
-   Never expose service-role keys.
-   Use private document storage.
-   Expire signed document URLs.
-   Restrict document access to authorised users and jobs.
-   Encrypt agent credentials at rest.
-   Support agent revocation.
-   Audit printer registration and job execution.
-   Apply rate limits to agent endpoints.
-   Validate document types and file sizes.
-   Prevent arbitrary command execution.
-   Provide account and device deletion workflows.

# 11. Monetisation Strategy

Printer management should have a free entry point.

Users should be able to experience the basic value of connecting and
monitoring a printer before being asked to subscribe.

Proposed plan structure:

  Capability                Free                Personal Plus   Business
  ------------------------- ------------------- --------------- ------------------
  Printer registration      Limited             Expanded        Multiple devices
  Basic printer status      Yes                 Yes             Yes
  Consumable monitoring     Supported devices   Yes             Yes
  Basic alerts              Yes                 Yes             Yes
  Usage history             Limited             Extended        Extended
  Cost analytics            No                  Yes             Yes
  Multiple users            No                  No              Yes
  Multiple locations        No                  No              Yes
  Marketplace integration   Optional            Optional        Yes
  Advanced reports          No                  No              Yes

Exact limits and prices must be established after validating customer
demand and infrastructure costs.

AI subscriptions and AI-specific billing are explicitly excluded.

# 12. User Experience and Onboarding

## 12.1 Personal user journey

1.  Sign up or log in.
2.  Open My Printers.
3.  Download InkNeighbour Connect.
4.  Install the Windows agent.
5.  Pair with the InkNeighbour account.
6.  Discover available printers.
7.  Select and register printers.
8.  View the printer dashboard.
9.  Configure alerts.
10. Track printing activity and consumables.

## 12.2 Marketplace provider journey

1.  Log in to the existing provider account.
2.  Open My Printers.
3.  Pair InkNeighbour Connect.
4.  Register printers.
5.  Associate selected printers with the marketplace provider.
6.  Configure printer availability.
7.  Assign eligible customer jobs.
8.  Track execution and failures.

## 12.3 UX principles

-   Do not force marketplace registration for personal users.
-   Do not force existing providers through a second registration
    process.
-   Explain why a desktop agent is required.
-   Display the last successful communication time.
-   Distinguish unavailable information from zero values.
-   Clearly label actual, estimated and manually entered readings.
-   Provide clear onboarding and troubleshooting instructions.

# 13. Phased Implementation Roadmap

## Phase 0 --- Repository Audit and Hardware Validation

**Priority: Critical**

Goal: Confirm implementation feasibility before building the full
platform.

Deliverables:

-   Review React application structure.
-   Review existing routes and components.
-   Review Supabase schema and migrations.
-   Review existing RLS policies.
-   Identify owner and job relationships.
-   Select representative USB and network printers.
-   Build a minimal Windows discovery prototype.
-   Validate printer status reporting.
-   Validate consumable reporting.

Exit criteria:

-   At least two representative printer models successfully discovered.
-   Supported capabilities documented.
-   Known limitations recorded.
-   Existing marketplace functionality unaffected.

## Phase 1 --- Printer Management Foundation

**Priority: Critical**

Goal: Deliver standalone printer registration and monitoring.

Deliverables:

-   Printer account model.
-   Agent pairing.
-   Windows agent MVP.
-   USB and network discovery.
-   Printer registration.
-   Printer dashboard.
-   Basic status monitoring.
-   Agent heartbeat.
-   Agent revocation.
-   Account-level security.

Exit criteria:

-   Personal user can connect a printer.
-   Registered printer appears in the application.
-   Status telemetry reaches the dashboard.
-   Offline devices are identified.
-   Account isolation is verified.

## Phase 2 --- Consumables and Alerts

**Priority: High**

Goal: Make printer monitoring valuable for regular use.

Deliverables:

-   Ink and toner readings.
-   Capability classification.
-   Supply history.
-   Low-supply alerts.
-   Page counter integration where available.
-   Usage history.
-   Notification preferences.
-   Basic analytics.

Exit criteria:

-   Supported readings are correctly classified.
-   Historical readings are stored.
-   Alerts are generated reliably.
-   Unsupported devices are handled honestly.

## Phase 3 --- Print Execution

**Priority: High**

Goal: Allow users to print through registered printers.

Deliverables:

-   Document upload.
-   Private document storage.
-   Print queue.
-   Printer selection.
-   Windows job execution.
-   Job status reporting.
-   Failure handling.
-   Retry workflows.
-   Personal printing history.

Exit criteria:

-   Authorised users can submit print jobs.
-   Selected printers receive authorised jobs.
-   Job execution events are recorded.
-   Cross-account access is prevented.

## Phase 4 --- Marketplace Integration

**Priority: High**

Goal: Connect printer management with existing marketplace workflows.

Deliverables:

-   Associate printers with marketplace providers.
-   Assign customer jobs to registered printers.
-   Provider print queue.
-   Job execution tracking.
-   Failed-job workflows.
-   Provider operational analytics.

Exit criteria:

-   Existing marketplace orders continue working.
-   Providers can assign eligible jobs to registered printers.
-   Customer documents remain private.
-   Job status is available to authorised participants.

## Phase 5 --- Bulk Quote Requests (RFQ) --- Deferred

**Priority: Deferred (not in active scope)**

Idea: a customer with a bulk order (for example flyers, brochures,
booklets) posts a structured request. Nearby providers that can do the
job submit sealed bids. The customer picks one, the work is done through
the platform, and the customer reviews it afterwards.

Why it differentiates: walk-in shops tend to quote the same rate once
they can see each other. Sealed bids from several providers restore
price competition, and registered printer capabilities mean only
providers who can do the job are asked to bid.

Design guardrails (to avoid disintermediation):

-   Sealed bids; customer contact details hidden until award.
-   Payment or deposit through the platform, released on confirmed
    delivery.
-   Providers pay only when they win (no pay-per-lead).
-   Reviews only for platform-completed orders.
-   Providers need a capability profile covering process (digital or
    offset), paper sizes, maximum run and finishing. The Windows agent
    covers digital printers only; offset presses need a manual profile.

Cheap preparation now (no RFQ build): capture structured job specs and
keep the provider capability profile; allow orders to link to an
accepted quote later.

Open questions before any build: bid window and how long a quote stays
valid; how a winner is chosen (price only, or price plus reliability
score); deposit and release rules; dispute handling; minimum number of
eligible providers per area before RFQ is useful; whether offset-press
shops are onboarded manually for the pilot. Needs its own spec and
security review (payments and contact-detail hiding).

# 13a. Implementation status (updated 16 November 2026)

Built: cloud foundation, My Printers page, Windows agent with read-only
monitoring (WMI discovery, SNMP supplies, read-only print queue count),
alerts, login-gated agent download, exe that installs itself and pairs
with a code, removing a computer also removes its printers.

Decisions that differ from the proposal above:

-   The agent ships **unsigned** for now (certificate cost). SmartScreen
    warns on first run; the pairing steps tell the owner how to proceed.
    Section 6.4 "Signed installers" is deferred, not dropped.
-   Distribution is a zip with a single exe (no PowerShell scripts),
    uploaded by hand to a private bucket and served through a 60-second
    signed URL to signed-in users only.
-   The agent receives no commands from the cloud. Pause, resume and
    cancel on queued jobs (remote management) and print execution need a
    secure command channel and a separate reviewed design.
-   Queue count is read-only and optional; unknown stays unknown.

Not yet verified: the Windows-only paths (installer, service, WMI,
credential store, queue accuracy) need a pilot on a real PC and
printer. Pilot shop details are still unknown.

# 14. Success Metrics

## Adoption

-   Registered printer accounts.
-   Active connected printers.
-   Agent pairing completion rate.
-   Number of printers per account.
-   Returning printer-management users.

## Reliability

-   Agent heartbeat success rate.
-   Telemetry delivery success rate.
-   Printer discovery success rate by model.
-   Job execution success rate.
-   Agent crash rate.
-   Time since last successful telemetry.

## Engagement

-   Monthly active printer accounts.
-   Alert engagement.
-   Number of monitored printers.
-   Personal printing jobs.
-   Provider print jobs.

## Business

-   Free-to-paid conversion.
-   Personal subscription retention.
-   Business subscription adoption.
-   Marketplace provider retention.
-   Revenue per active printer account.

Targets will be established after the initial pilot.

# 15. Risks and Mitigations

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  Inconsistent ink reporting          Capability-based telemetry

  Different printer protocols         Validated compatibility matrix

  Windows agent installation friction Signed installer and onboarding

  Agent connectivity failures         Heartbeats and retry mechanisms

  Security concerns                   Outbound-only communication and
                                      scoped credentials

  Marketplace disruption              Additive migrations and regression
                                      testing

  Incorrect print completion claims   Distinguish spooler status from
                                      physical confirmation

  Excessive telemetry volume          Retention and aggregation policies

  Unsupported printers                Explicit capability and
                                      compatibility status
  -----------------------------------------------------------------------

# 16. Explicitly Deferred Scope --- AI Intelligence

**Status: PAUSED**

AI Intelligence is a future product opportunity, not an active
implementation requirement.

The following features are deferred:

-   Predictive ink and toner depletion.
-   AI troubleshooting.
-   Intelligent maintenance recommendations.
-   AI-generated usage summaries.
-   AI-based cost optimisation.
-   Automated printer recommendations.
-   LLM integrations.
-   Prediction engines.
-   AI-specific subscriptions.
-   AI-specific infrastructure and workflows.

## Data preservation requirements

Although AI is deferred, the platform must preserve the data required
for potential future intelligence.

This includes:

-   Historical printer status.
-   Consumable readings and changes.
-   Page counters where supported.
-   Print-job history.
-   Printer error events.
-   Agent connectivity history.
-   Measurement timestamps.
-   Reading source and reliability classification.

These records must use consistent structures and timestamps.

**Important:** Data collection must serve current operational needs. Do
not build excessive telemetry pipelines merely in anticipation of AI.

There is no requirement to build AI abstractions, AI-specific tables or
AI service integrations now.

AI can be reconsidered after the core printer-management platform
demonstrates product-market value.

# 17. Release Constraints and Product Decisions

The following decisions are binding for the current implementation:

1.  Printer management is a core InkNeighbour USP.
2.  Personal printer management is available without marketplace
    participation.
3.  Marketplace participation is optional.
4.  Existing marketplace functionality must be preserved.
5.  Windows desktop agent is the initial connectivity mechanism.
6.  React and Supabase remain the primary application stack.
7.  Printer management supports multiple printers per account.
8.  AI Intelligence is paused and excluded from active implementation.
9.  No AI APIs, prediction engines, AI subscriptions or AI
    infrastructure will be developed.
10. Historical telemetry and operational data must be retained in a
    clean structure.
11. Printer compatibility must be validated by model and capability.
12. Universal ink-level monitoring must not be claimed.
13. Database changes must be additive and migration-safe.
14. The first releases prioritise reliability over feature breadth.

# 18. Final Product Definition

InkNeighbour is a printing ecosystem connecting:

-   People who need documents printed.
-   People who provide printing services.
-   People who own printers.
-   Businesses operating multiple printers.

The Marketplace connects printing demand and supply.

Printer Management connects users with their own physical printing
infrastructure.

Print Execution makes those printers usable through InkNeighbour.

Future intelligence capabilities may build on the resulting operational
data, but they are not part of the current product scope.

## Product USP

**InkNeighbour doesn't just help you find a printer. It helps you manage
the printer you already own.**

## Core product promise

**Connect. Monitor. Manage. Print.**

## Brand line

**Print It. Drop It. Done.**
