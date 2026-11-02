import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const outputPath = resolve('documentation/Polycheck_Seeded_Test_Accounts.pdf')
mkdirSync(dirname(outputPath), { recursive: true })

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Polycheck — Official Seeded Test Accounts Guide</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 14mm 16mm 14mm;
      @bottom-right {
        content: counter(page) " of " counter(pages);
        font-family: 'DM Sans', sans-serif;
        font-size: 8pt;
        color: #71717a;
      }
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #18181b;
      line-height: 1.45;
      font-size: 9pt;
      background: #ffffff;
    }

    .header-banner {
      background: linear-gradient(135deg, #7B1113 0%, #4A0A0B 100%);
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 4px;
      margin-bottom: 16px;
      border-bottom: 3px solid #FFDF00;
    }

    .institution-tag {
      color: #FFDF00;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    h1 {
      font-family: Georgia, serif;
      font-size: 18pt;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 2px;
    }

    .header-sub {
      color: rgba(255, 255, 255, 0.85);
      font-size: 9pt;
    }

    .notice-card {
      background: #fafafa;
      border: 1px solid #e4e4e7;
      border-left: 4px solid #7B1113;
      padding: 10px 14px;
      margin-bottom: 14px;
      border-radius: 2px;
    }

    .notice-card strong {
      color: #7B1113;
    }

    .credentials-box {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 10px 14px;
      margin-bottom: 16px;
      border-radius: 2px;
    }

    .credentials-box strong {
      color: #92400e;
    }

    h2 {
      font-family: Georgia, serif;
      font-size: 12pt;
      color: #7B1113;
      border-bottom: 1.5px solid #e4e4e7;
      padding-bottom: 4px;
      margin-top: 14px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .account-card {
      border: 1px solid #e4e4e7;
      border-radius: 4px;
      margin-bottom: 10px;
      background: #ffffff;
      page-break-inside: avoid;
    }

    .account-header {
      background: #f4f4f5;
      padding: 7px 12px;
      border-bottom: 1px solid #e4e4e7;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .account-title {
      font-weight: 700;
      font-size: 9.5pt;
      color: #18181b;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 7.5pt;
      font-weight: 700;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-admin { background: #7B1113; color: #ffffff; }
    .badge-it { background: #0284c7; color: #ffffff; }
    .badge-head { background: #7c3aed; color: #ffffff; }
    .badge-reg { background: #059669; color: #ffffff; }
    .badge-teacher { background: #52525b; color: #ffffff; }
    .badge-student { background: #d97706; color: #ffffff; }

    .account-body {
      padding: 9px 12px;
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 5px 12px;
      font-size: 8.5pt;
    }

    .field-label {
      color: #71717a;
      font-weight: 600;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .field-value {
      color: #09090b;
      word-break: break-word;
    }

    .code-pill {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: #f4f4f5;
      padding: 1px 5px;
      border-radius: 3px;
      border: 1px solid #e4e4e7;
      font-size: 8pt;
    }

    .features-list {
      grid-column: 1 / -1;
      margin-top: 4px;
      padding-top: 5px;
      border-top: 1px dashed #e4e4e7;
    }

    .features-list ul {
      margin-left: 18px;
      margin-top: 3px;
    }

    .features-list li {
      margin-bottom: 2px;
    }

    .sod-note {
      grid-column: 1 / -1;
      font-size: 8pt;
      color: #b91c1c;
      background: #fef2f2;
      padding: 4px 8px;
      border-radius: 3px;
      margin-top: 4px;
    }

    table.styled-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 12px;
      font-size: 8pt;
    }

    table.styled-table th {
      background: #7B1113;
      color: #ffffff;
      text-align: left;
      padding: 6px 8px;
      font-weight: 600;
      border: 1px solid #7B1113;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    table.styled-table td {
      padding: 5px 8px;
      border: 1px solid #e4e4e7;
      vertical-align: top;
    }

    table.styled-table tr:nth-child(even) {
      background: #fafafa;
    }

    .check-yes { color: #059669; font-weight: bold; }
    .check-no { color: #d4d4d8; text-align: center; }

    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>

  <div class="header-banner">
    <div class="institution-tag">Polytechnic University of the Philippines — Santa Maria Branch</div>
    <h1>Polycheck Seeded Test Accounts Guide</h1>
    <div class="header-sub">Official Role-Based Access Control (RBAC), Dual-Hat Faculty Designations & Demonstration Directory</div>
  </div>

  <div class="credentials-box">
    <strong>Universal Master Credentials:</strong>
    <div style="margin-top: 4px; font-size: 8.5pt;">
      <div>• <strong>Master Password:</strong> <span class="code-pill">PolycheckSeed123!</span> <em>(or <span class="code-pill">Polycheck@2026!</span> on local dev)</em></div>
      <div>• <strong>Faculty / Admin Login Portal:</strong> <span class="code-pill">/login/faculty</span> (Web) or Campus Faculty Screen (Mobile)</div>
      <div>• <strong>Student Login Portal:</strong> <span class="code-pill">/login/student</span> (Web) or Campus Student Screen (Mobile)</div>
      <div>• <strong>Live Production API:</strong> <span class="code-pill">https://polycheck-api.addtokart.tech/api</span></div>
    </div>
  </div>

  <h2>1. Administrative & Dual-Hat Faculty Accounts</h2>
  <p style="font-size: 8pt; color: #52525b; margin-bottom: 8px;">
    In accordance with the PUP Santa Maria concurrent faculty appointment model, instructors hold specialized administrative designations under a single login identity, governed by Separation of Duties (SoD).
  </p>

  <!-- Super Admin -->
  <div class="account-card">
    <div class="account-header">
      <span class="account-title">Dr. Maria Concepcion Reyes — Super Admin (Branch Director)</span>
      <span class="badge badge-admin">Super Admin</span>
    </div>
    <div class="account-body">
      <div class="field-label">Email Address</div>
      <div class="field-value"><strong>mcreyes@pup.edu.ph</strong></div>
      <div class="field-label">Department / Scope</div>
      <div class="field-value">Institution-Wide (All Departments)</div>
      <div class="field-label">Primary Surface</div>
      <div class="field-value">Institutional Governance Console (<span class="code-pill">/faculty</span>)</div>
      <div class="features-list">
        <strong>Capabilities & Permissions:</strong>
        <ul>
          <li>Full oversight over all faculty, students, system audit logs, and institutional settings.</li>
          <li>Assigns/revokes faculty designations (<span class="code-pill">isItCoordinator</span>, <span class="code-pill">isDepartmentHead</span>, <span class="code-pill">isUserRegistrar</span>).</li>
          <li>Option A Architecture: Classroom feeds are omitted from sidebar to preserve executive oversight separation.</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- IT Coordinator -->
  <div class="account-card">
    <div class="account-header">
      <span class="account-title">Prof. Bryan M. Salazar — IT Coordinator / MIS Officer</span>
      <span class="badge badge-it">IT Coordinator</span>
    </div>
    <div class="account-body">
      <div class="field-label">Email Address</div>
      <div class="field-value"><strong>bry.mis@pup.edu.ph</strong></div>
      <div class="field-label">Department</div>
      <div class="field-value">College of Computer and Information Sciences (CCIS)</div>
      <div class="field-label">Appended Suite</div>
      <div class="field-value"><strong>IT Operations Suite</strong> in faculty navigation</div>
      <div class="features-list">
        <strong>Capabilities & Key Demonstration Steps:</strong>
        <ul>
          <li><strong>Server Status (<span class="code-pill">/faculty/server-status</span>):</strong> Live server health metrics, CPU, RAM, active WebSocket subscribers.</li>
          <li><strong>System Issue Reports (<span class="code-pill">/faculty/system-reports</span>):</strong> Triage campus bug reports and inspect student error screenshots.</li>
          <li><strong>Maintenance Mode (<span class="code-pill">/faculty/settings?tab=system</span>):</strong> Can activate campus-wide maintenance mode and set estimated resumption times.</li>
        </ul>
      </div>
      <div class="sod-note">
        <strong>Separation of Duties (SoD):</strong> Cannot review academic excuse letters or modify student classroom roster records.
      </div>
    </div>
  </div>

  <!-- Department Head -->
  <div class="account-card">
    <div class="account-header">
      <span class="account-title">Dr. Corazon B. Aquino — Department Chairperson</span>
      <span class="badge badge-head">Department Head</span>
    </div>
    <div class="account-body">
      <div class="field-label">Email Address</div>
      <div class="field-value"><strong>chair.ccis@pup.edu.ph</strong></div>
      <div class="field-label">Department Scope</div>
      <div class="field-value">College of Computer and Information Sciences (CCIS)</div>
      <div class="field-label">Appended Suite</div>
      <div class="field-value"><strong>Academic Department Oversight</strong> in faculty navigation</div>
      <div class="features-list">
        <strong>Capabilities & Key Demonstration Steps:</strong>
        <ul>
          <li><strong>Department Reports (<span class="code-pill">/faculty/reports</span>):</strong> Aggregated attendance summaries across all CCIS professors and sections.</li>
          <li><strong>Campus Excuses Queue (<span class="code-pill">/faculty/excuses</span>):</strong> Adjudicate student absence excuse requests for all CCIS sections.</li>
          <li><strong>At-Risk Students (<span class="code-pill">/faculty/at-risk</span>):</strong> Monitor students falling below the 80% CHED attendance floor.</li>
        </ul>
      </div>
      <div class="sod-note">
        <strong>Separation of Duties (SoD):</strong> Scoped strictly to CCIS department; cannot toggle server maintenance mode or access raw server telemetry.
      </div>
    </div>
  </div>

  <!-- Registrar -->
  <div class="account-card">
    <div class="account-header">
      <span class="account-title">Prof. Ricardo S. Domingo — Campus Registrar</span>
      <span class="badge badge-reg">Registrar</span>
    </div>
    <div class="account-body">
      <div class="field-label">Email Address</div>
      <div class="field-value"><strong>reg.campus@pup.edu.ph</strong></div>
      <div class="field-label">Department Scope</div>
      <div class="field-value">CCIS / Departmental Accounts</div>
      <div class="field-label">Appended Suite</div>
      <div class="field-value"><strong>Registrar Suite</strong> in faculty navigation</div>
      <div class="features-list">
        <strong>Capabilities & Key Demonstration Steps:</strong>
        <ul>
          <li><strong>User Management (<span class="code-pill">/faculty/users</span>):</strong> Manage student and faculty accounts in their department.</li>
          <li><strong>Password Resets:</strong> Generate temporary passwords for students and instructors.</li>
          <li><strong>Roster CSV Bulk Imports:</strong> Import new section enrollments and student directory batches.</li>
        </ul>
      </div>
      <div class="sod-note">
        <strong>Separation of Duties (SoD):</strong> Cannot promote Super Admins or change faculty administrative designations.
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- Regular Teaching Faculty -->
  <div class="account-card">
    <div class="account-header">
      <span class="account-title">Prof. Juan Miguel Dela Cruz / Prof. Maria Elena Santos — Teaching Faculty</span>
      <span class="badge badge-teacher">Faculty</span>
    </div>
    <div class="account-body">
      <div class="field-label">Email Addresses</div>
      <div class="field-value"><strong>jmdelacruz@pup.edu.ph</strong> / <strong>mesantos@pup.edu.ph</strong></div>
      <div class="field-label">Department</div>
      <div class="field-value">CCIS (Computer Science & Information Technology)</div>
      <div class="field-label">Role Interface</div>
      <div class="field-value">Standard Teaching Workspace (<span class="code-pill">/faculty</span>)</div>
      <div class="features-list">
        <strong>Capabilities:</strong>
        <ul>
          <li>Classroom subject creation, schedule management, and section configuration.</li>
          <li>Generates cryptographically signed QR codes (In-Person: Geofenced; Online: Zero-GPS dual checkpoints).</li>
          <li>Attendance roster cockpit, manual status override, and student dispute adjudication.</li>
        </ul>
      </div>
    </div>
  </div>

  <h2>2. Seeded Student Accounts Roster</h2>
  <table class="styled-table">
    <thead>
      <tr>
        <th>Student Name</th>
        <th>Student ID</th>
        <th>Email Address</th>
        <th>Program & Year</th>
        <th>Key Features to Test</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Alexandra Marie Reyes</strong></td>
        <td><span class="code-pill">2024-00001-MN-0</span></td>
        <td>amreyes@iskolar.pup.edu.ph</td>
        <td>BS Computer Science (Year 2)</td>
        <td>Meeting PIN input on online scan, Geofence scan, Excuse letters</td>
      </tr>
      <tr>
        <td><strong>Benjamin Lucas Santos</strong></td>
        <td><span class="code-pill">2024-00002-MN-0</span></td>
        <td>blsantos@iskolar.pup.edu.ph</td>
        <td>BS Computer Science (Year 2)</td>
        <td>Class schedule timetable, digital ID card flip, disputes</td>
      </tr>
      <tr>
        <td><strong>Camille Andrea Villanueva</strong></td>
        <td><span class="code-pill">2024-00003-MN-0</span></td>
        <td>cavillanueva@iskolar.pup.edu.ph</td>
        <td>BS Computer Science (Year 2)</td>
        <td>Enrollment code registration, standing projection alerts</td>
      </tr>
      <tr>
        <td><strong>Daniel Joseph Cruz</strong></td>
        <td><span class="code-pill">2024-00004-MN-0</span></td>
        <td>djcruz@iskolar.pup.edu.ph</td>
        <td>BS Computer Science (Year 2)</td>
        <td>Single active session replacement test (logging in on 2nd device)</td>
      </tr>
      <tr>
        <td><strong>Erika Mae Gonzales</strong></td>
        <td><span class="code-pill">2024-00005-MN-0</span></td>
        <td>emgonzales@iskolar.pup.edu.ph</td>
        <td>BS Computer Science (Year 2)</td>
        <td>Dual checkpoint online attendance (Check-in + Check-out)</td>
      </tr>
      <tr>
        <td><strong>Francis Dominic Reyes</strong></td>
        <td><span class="code-pill">2024-00006-MN-0</span></td>
        <td>fdreyes@iskolar.pup.edu.ph</td>
        <td>BS Computer Science (Year 2)</td>
        <td>Anti-teleportation concurrent class conflict testing</td>
      </tr>
      <tr>
        <td><strong>Gabriella Sofia Mendoza</strong></td>
        <td><span class="code-pill">2024-00007-MN-0</span></td>
        <td>gsmendoza@iskolar.pup.edu.ph</td>
        <td>BS Computer Science (Year 2)</td>
        <td>Offline attendance scanning and sync queue preservation</td>
      </tr>
      <tr>
        <td><strong>Henry William Tan</strong></td>
        <td><span class="code-pill">2024-00008-MN-0</span></td>
        <td>hwtan@iskolar.pup.edu.ph</td>
        <td>BS Computer Science (Year 2)</td>
        <td>Attendance dispute submission and resolution tracking</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Institutional Separation of Duties (SoD) Matrix</h2>
  <table class="styled-table">
    <thead>
      <tr>
        <th>System Capability / Surface</th>
        <th>Super Admin</th>
        <th>IT Coordinator</th>
        <th>Dept. Head</th>
        <th>Registrar</th>
        <th>Faculty</th>
        <th>Student</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Create & Activate Classroom QR Sessions</td>
        <td class="check-no">—</td>
        <td class="check-yes">✓ (own)</td>
        <td class="check-yes">✓ (own)</td>
        <td class="check-yes">✓ (own)</td>
        <td class="check-yes">✓ (own)</td>
        <td class="check-no">—</td>
      </tr>
      <tr>
        <td>Scan QR Code with Meeting PIN</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-yes">✓</td>
      </tr>
      <tr>
        <td>View Live Server Metrics & Telemetry</td>
        <td class="check-yes">✓</td>
        <td class="check-yes">✓</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
      </tr>
      <tr>
        <td>Toggle Campus Maintenance Mode</td>
        <td class="check-yes">✓</td>
        <td class="check-yes">✓</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
      </tr>
      <tr>
        <td>Triage Campus-Wide Issue Reports</td>
        <td class="check-yes">✓</td>
        <td class="check-yes">✓</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
      </tr>
      <tr>
        <td>Review Department Excuse Letters</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-yes">✓ (dept)</td>
        <td class="check-no">—</td>
        <td class="check-yes">✓ (own)</td>
        <td class="check-no">—</td>
      </tr>
      <tr>
        <td>View Department-Wide Analytics & Exports</td>
        <td class="check-yes">✓ (all)</td>
        <td class="check-no">—</td>
        <td class="check-yes">✓ (dept)</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
      </tr>
      <tr>
        <td>User Management & Password Resets</td>
        <td class="check-yes">✓ (all)</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-yes">✓ (dept)</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
      </tr>
      <tr>
        <td>Assign Faculty Designations (Dual-Hat)</td>
        <td class="check-yes">✓</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
        <td class="check-no">—</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Recommended Demonstration & Defense Scenarios</h2>
  <div class="notice-card" style="font-size: 8.5pt;">
    <strong>Scenario 1: Testing Separation of Duties (PUP Santa Maria Alignment)</strong>
    <p style="margin-top: 3px;">
      Log in as <strong>Prof. Bryan Salazar</strong> (<span class="code-pill">bry.mis@pup.edu.ph</span>). Point out the <em>IT Operations Suite</em> (Server Status, Issue Reports, Maintenance). Then log in as <strong>Dr. Corazon Aquino</strong> (<span class="code-pill">chair.ccis@pup.edu.ph</span>) to demonstrate how the interface switches to <em>Academic Department Oversight</em> (Department Reports, Campus Excuses, At-Risk Students).
    </p>
  </div>

  <div class="notice-card" style="font-size: 8.5pt;">
    <strong>Scenario 2: Institutional Maintenance Mode with Offline Preservation</strong>
    <p style="margin-top: 3px;">
      As IT Coordinator or Super Admin, navigate to <em>Settings → System Tab</em> and enable Maintenance Mode. Log in as a student in an incognito window: observe the full-screen branded maintenance overlay with countdown. Meanwhile, demonstrate that offline attendance scans on mobile continue to save safely to SQLite without error.
    </p>
  </div>

  <div class="notice-card" style="font-size: 8.5pt;">
    <strong>Scenario 3: Zero-GPS Hybrid Mode & Meeting PIN Verification</strong>
    <p style="margin-top: 3px;">
      As regular faculty (<span class="code-pill">jmdelacruz@pup.edu.ph</span>), activate an <em>Online</em> session. Note the 4-digit meeting PIN and dual checkpoint buttons (Start QR vs End QR). On student scan, verify that GPS coordinates are never requested (RA 10173 compliance) and the student must enter the meeting PIN to confirm virtual room presence.
    </p>
  </div>

</body>
</html>
`

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setContent(htmlContent, { waitUntil: 'load' })
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '12mm',
      bottom: '14mm',
      left: '12mm',
      right: '12mm',
    },
  })
  await browser.close()
  console.log(`PDF successfully generated at: ${outputPath}`)
}

main().catch((err) => {
  console.error('Error generating PDF:', err)
  process.exit(1)
})

