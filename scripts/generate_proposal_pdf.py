#!/usr/bin/env python3

from weasyprint import HTML, CSS

html_content = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>IAPP Europe Congress 2026 — Speaking Proposal</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  /* Standard page margins */
  @page {
    size: A4;
    margin: 2.2cm 2.5cm 2.8cm 2.5cm;

    @bottom-center {
      content: counter(page);
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 8.5pt;
      color: #aaa;
    }
  }

  /* Cover page: full bleed, own margins, no page number */
  @page cover-page {
    size: A4;
    margin: 0;

    @bottom-center {
      content: none;
    }
  }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #1a1a1a;
    background: #fff;
  }

  /* ── COVER ────────────────────────────────── */
  .cover {
    page: cover-page;
    page-break-after: always;
    padding: 68pt 64pt 60pt 64pt;
    height: 29.7cm; /* A4 height */
    display: block;
    position: relative;
  }

  .cover-label {
    font-size: 8pt;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 52pt;
    display: block;
  }

  .cover-title {
    font-size: 21pt;
    font-weight: 700;
    line-height: 1.22;
    color: #111;
    max-width: 400pt;
    margin-bottom: 22pt;
  }

  .cover-venue {
    font-size: 11.5pt;
    font-weight: 600;
    color: #333;
    margin-bottom: 5pt;
  }

  .cover-meta {
    font-size: 9.5pt;
    color: #888;
    margin-bottom: 3pt;
  }

  .cover-rule {
    display: block;
    width: 44pt;
    border: none;
    border-top: 3pt solid #111;
    margin: 34pt 0;
  }

  .cover-speaker {
    font-size: 11.5pt;
    font-weight: 700;
    color: #111;
  }

  .cover-sub {
    font-size: 9.5pt;
    color: #555;
    margin-top: 4pt;
    display: block;
  }

  /* ── SECTION WRAPPERS ─────────────────────── */
  .section {
    page-break-after: always;
  }

  .section-last {
    /* no forced break after final section */
  }

  /* ── TYPOGRAPHY ───────────────────────────── */
  h1 {
    font-size: 15pt;
    font-weight: 700;
    color: #111;
    margin-bottom: 18pt;
    padding-bottom: 9pt;
    border-bottom: 2pt solid #111;
    page-break-after: avoid;
    break-after: avoid;
  }

  h2 {
    font-size: 9pt;
    font-weight: 700;
    color: #111;
    margin-top: 26pt;
    margin-bottom: 9pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    page-break-after: avoid;
    break-after: avoid;
  }

  h3 {
    font-size: 10.5pt;
    font-weight: 600;
    color: #222;
    margin-top: 18pt;
    margin-bottom: 7pt;
    page-break-after: avoid;
    break-after: avoid;
  }

  p {
    margin-bottom: 11pt;
    orphans: 3;
    widows: 3;
  }

  ul, ol {
    margin-left: 17pt;
    margin-bottom: 11pt;
  }

  li {
    margin-bottom: 5pt;
    orphans: 2;
    widows: 2;
  }

  /* ── TABLES ───────────────────────────────── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12pt 0 16pt 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  th {
    background: #111;
    color: #fff;
    font-weight: 600;
    padding: 7pt 9pt;
    text-align: left;
  }

  td {
    padding: 6.5pt 9pt;
    border-bottom: 0.5pt solid #ddd;
    vertical-align: top;
  }

  tr:nth-child(even) td {
    background: #f8f8f8;
  }

  /* ── LEARNINGS ────────────────────────────── */
  .learning {
    margin-bottom: 9pt;
    padding: 7pt 11pt;
    border-left: 3pt solid #111;
    background: #fafafa;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .learning-num {
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 3pt;
  }

  .learning p {
    margin: 0;
    font-size: 10pt;
  }

  /* ── DIVIDER ──────────────────────────────── */
  .rule {
    display: block;
    border: none;
    border-top: 0.5pt solid #ddd;
    margin: 20pt 0;
  }

  /* ── REFERENCES ───────────────────────────── */
  .ref-list {
    font-size: 9pt;
    color: #444;
    line-height: 1.55;
  }

  .ref-list li {
    margin-bottom: 5pt;
  }
</style>
</head>
<body>

<!-- ════ COVER PAGE ════ -->
<div class="cover">
  <span class="cover-label">Speaking Proposal — IAPP Europe Congress 2026</span>

  <div class="cover-title">Your AI Act Compliance Will Fail the Same Way GDPR Did,&nbsp;and What to Do Instead</div>

  <div class="cover-venue">IAPP Europe Congress 2026</div>
  <div class="cover-meta">16–19 November 2026 &nbsp;·&nbsp; Brussels, Belgium</div>
  <div class="cover-meta">Submission Deadline: 12 April 2026</div>

  <hr class="cover-rule">

  <div class="cover-speaker">Mbali Chaise</div>
  <span class="cover-sub">Founder, HSTM (Humane Systems That Matter)</span>
  <span class="cover-sub">mbali@systemsthatmatter.com</span>
  <span class="cover-sub">linkedin.com/in/mbali-chaise-44b77a39</span>
</div>

<!-- ════ SPEAKER DETAILS ════ -->
<div class="section">
  <h1>Speaker Details</h1>

  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Name</td><td>Mbali Chaise</td></tr>
    <tr><td>Title / Designation</td><td>Founder</td></tr>
    <tr><td>Company</td><td>HSTM (Humane Systems That Matter)</td></tr>
    <tr><td>Email</td><td>mbali@systemsthatmatter.com</td></tr>
    <tr><td>LinkedIn</td><td>https://uk.linkedin.com/in/mbali-chaise-44b77a39</td></tr>
  </table>

  <h2>Speaker Biography</h2>

  <p>Mbali Chaise is the founder of HSTM (Humane Systems That Matter), a structural advisory practice for AI governance based in Estonia. HSTM works with mid-market organisations to diagnose the organisational gaps that cause compliance frameworks to fail: unclear decision authority, ungovernable knowledge infrastructure, and governance intent that degrades between policy and practice.</p>

  <p>Before founding HSTM, Mbali spent over a decade in workplace strategy, organisational change, and behavioural design, working internationally across South Africa, Canada, and the UK. As Associate Director at iPWC and a consultant on the Workplace Trends Register, she led change programmes across Legal, Finance, Pharma, Tech, Defence, and Non-profit sectors. Her work focused on why organisations fail to absorb change and how to design the structures that make it stick.</p>

  <p>HSTM applies that same structural and behavioural lens to AI governance. In 2026, the practice conducted governance assessments using its own methodology, producing the diagnostic data referenced in this proposal. The practice bridges GDPR's 10-year implementation record with EU AI Act compliance readiness, focusing on the deployer obligations that most commentary overlooks.</p>

  <hr class="rule">

  <h2>Session Details</h2>

  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Session Title</td><td>Your AI Act Compliance Will Fail the Same Way GDPR Did, and What to Do Instead</td></tr>
    <tr><td>Presentation Type</td><td>Single Speaker Presentation</td></tr>
    <tr><td>Audience Level</td><td>Intermediate</td></tr>
    <tr><td>Topic Category</td><td>AI Governance Program Management</td></tr>
    <tr><td>Subject Tags</td><td>AI Governance · Audit &amp; Assurance · Frameworks &amp; Standards · Risk Management · Strategy &amp; Governance</td></tr>
  </table>

</div>

<!-- ════ LEARNINGS + GOAL ════ -->
<div class="section">
  <h1>Key Learnings &amp; Goal</h1>

  <h2>Three Key Learnings</h2>

  <div class="learning">
    <div class="learning-num">Learning 1</div>
    <p>EUR 7.1 billion in GDPR fines did not fix the structural problem. Meta has been fined EUR 2.8 billion across seven decisions and has thousands of lawyers. What was missing was governance that actually prevented non-compliant outcomes. The AI Act faces the same pattern under worse conditions.</p>
  </div>

  <div class="learning">
    <div class="learning-num">Learning 2</div>
    <p>Buying a compliance platform without changing how your organisation makes decisions is the AI Act equivalent of hiring a DPO and calling it done. Platforms automate controls. They do not build the organisational capacity to hold them.</p>
  </div>

  <div class="learning">
    <div class="learning-num">Learning 3</div>
    <p>AI Act implementation is organisational change at regulatory speed. The structural patterns that cause most large-scale change programmes to fail are visible in many current AI compliance approaches.</p>
  </div>

  <div style="page-break-inside: avoid; break-inside: avoid;">
  <hr class="rule">
  <h2>Goal Statement</h2>
  <p>Equip compliance professionals with a structural diagnostic framework for identifying where AI Act compliance will fail at the organisational layer, using GDPR's quantified enforcement record and change management research as predictive evidence.</p>
  </div>

</div>

<!-- ════ PROPOSAL BODY ════ -->
<div class="section-last">
  <h1>Proposal</h1>

  <h2>Introduction</h2>

  <p>In 2018, 87% of organisations could not estimate their GDPR compliance costs before the enforcement deadline. Seven years later, EUR 7.1 billion in fines has not solved the problem. The organisations fined most — Meta alone accounts for EUR 2.8 billion across seven decisions — have thousands of lawyers and dedicated privacy teams. What they did not have was governance that actually prevented non-compliant products from shipping, that covered how data flowed across all their internal systems, or that verified how authority was being exercised by their partners.</p>

  <p>The EU AI Act enters enforcement on 2 August 2026 with higher penalties (up to 7% of global revenue for prohibited practices; 3% or EUR 15 million for high-risk deployer violations), less clarity (harmonised standards not expected until four months after the enforcement deadline), and a compressed implementation window. The dominant response is familiar: hire lawyers, purchase compliance platforms, build policy libraries. These platforms automate evidence collection and control tracking. What they do not address is deployer-specific obligation guidance, structural governance design, or any mechanism for embedding governance into how an organisation actually makes decisions about AI.</p>

  <p>This is not a technology gap. It is a change management gap. And that changes who needs to be in the room.</p>

  <h2>The GDPR Evidence Base</h2>

  <p>GDPR's enforcement record is the most complete dataset available on how a major EU regulation interacts with organisational reality. Three findings are directly relevant to AI Act preparation.</p>

  <p><strong>First, the structural nature of the violations.</strong> Analysis of the 14 largest GDPR enforcement actions (totalling EUR 4.7 billion) reveals that the most frequently violated articles are not technical security requirements. They are transparency obligations (Articles 12, 13, 14), lawfulness principles (Article 5(1)(a)), data protection by design (Article 25), and lawful basis (Article 6). These are requirements that fail when organisational decision-making, product design processes, and partner oversight structures do not work. Meta was fined EUR 91 million because user passwords sat in plaintext on internal systems outside the scope of security review. Google was fined EUR 50 million because a consent process designed to make refusal difficult shipped to production. Enel was fined EUR 79.1 million because unauthorised companies operated through their CRM without oversight. In each case, compliance infrastructure existed. It did not prevent the outcome.</p>

  <p><strong>Second, the compliance plateau.</strong> Seven years after enforcement, most organisations have reached operational compliance — policies exist, processes are documented, breaches are reported — without reaching structural compliance, where governance is embedded in decision-making and adapts to new risks. The structural layer was never built.</p>

  <p><strong>Third, the change management parallel.</strong> Research consistently finds that the majority of large-scale organisational change initiatives fail, and the failure modes are structural: unclear authority, misaligned incentives, review processes that cannot keep pace with operational reality. Every one of these patterns appears in GDPR's enforcement record. The seven structural failure modes identified from the 14 largest GDPR fines — scope gaps, authority without enforcement power, velocity pressure, technical debt, distributed ownership, incentive misalignment, and audit frequency gaps — parallel what the change management literature identifies as root causes of failed transformation. This is not coincidence. Regulatory compliance is organisational change, and it fails for the same structural reasons.</p>

  <h2>Where the AI Act Is Worse</h2>

  <p>The AI Act compounds each of GDPR's structural weaknesses:</p>

  <ul>
    <li><strong>Higher stakes:</strong> up to 7% of global revenue for prohibited practices (Article 99(3)), 3% or EUR 15 million for high-risk system violations (Article 99(4)). GDPR's maximum was 4% or EUR 20 million.</li>
    <li><strong>Less clarity:</strong> CEN/CENELEC harmonised standards are not expected until December 2026, four months after the August enforcement deadline. Article 6 high-risk classification guidance missed its February 2026 deadline. Organisations must comply with obligations whose practical requirements are still being defined.</li>
    <li><strong>Greater structural demands:</strong> GDPR required a DPO and processing records. The AI Act requires a risk management system that is continuous, iterative, lifecycle-spanning, and documented (Article 9). It requires human oversight with persons who have "necessary competence, training and authority" (Article 14). It requires deployers to monitor operation, retain logs for six months, and conduct fundamental rights impact assessments (Article 26). Each of these is an organisational change requirement, not just a documentation requirement.</li>
    <li><strong>Deeper embedding:</strong> GDPR regulated data processing. Data processing policies can be updated. AI systems are different. Once deployed, they become integrated into operational workflows, shape decision-making processes, and create dependencies that are significantly harder to redesign than a consent mechanism or a privacy policy. The longer governance is absent, the more embedded the ungoverned systems become, and the more costly the eventual correction.</li>
  </ul>

  <p>Research across five countries found that more ambiguous regulation produced organisations with stronger governance practices than prescriptive regulation, because ambiguity forced genuine structural understanding rather than checkbox compliance (Bamberger &amp; Mulligan, MIT Press, 2015). The AI Act is currently in its most ambiguous phase. This is not a reason to wait. It is the condition under which structural investment pays off most.</p>

  <h2>The Structural Diagnosis</h2>

  <p>In 2026, HSTM conducted governance assessments on mid-market organisations using a methodology drawn from a decade of cross-sector change management practice. In one assessment, structural readiness scored 33%, with 10 governance gaps identified (4 critical, 4 high, 2 medium severity).</p>

  <p>The most common finding: AI-informed decisions were being made by people or systems that nobody had formally authorised to make them. Not because the organisation lacked policies, but because decision authority had never been structurally assigned for AI-assisted workflows. The policy existed. The operational process it was supposed to govern existed. They were disconnected.</p>

  <p>The diagnostic framework maps five structural layers against specific AI Act deployer obligations:</p>

  <table>
    <tr>
      <th>Structural Layer</th>
      <th>AI Act Article</th>
      <th>What Breaks</th>
    </tr>
    <tr>
      <td>Governance Gap</td>
      <td>Article 9 (Risk management)</td>
      <td>Nobody mapped which AI systems exist or how they are classified</td>
    </tr>
    <tr>
      <td>Decision Authority</td>
      <td>Article 14 (Human oversight)</td>
      <td>AI-informed decisions have no formally assigned owner with enforcement power</td>
    </tr>
    <tr>
      <td>Knowledge Infrastructure</td>
      <td>Articles 10–12 (Data, documentation, logging)</td>
      <td>Knowledge trapped in platforms that do not support governance requirements</td>
    </tr>
    <tr>
      <td>Context Architecture</td>
      <td>Article 13 (Transparency)</td>
      <td>Multiple AI systems produce conflicting outputs with no reconciliation process</td>
    </tr>
    <tr>
      <td>Structural Coherence</td>
      <td>Article 9 (Lifecycle risk management)</td>
      <td>Tools, governance processes, and operational workflows exist but do not connect</td>
    </tr>
  </table>

  <p>Each layer can be assessed before enforcement. The structural requirements are clear regardless of where classification guidance or harmonised standards land. Waiting for legal certainty before addressing structural readiness is the same approach that left most organisations scrambling when GDPR enforcement began.</p>

  <h2>What Predicts Better Outcomes</h2>

  <p><strong>1. Embed governance into the deployment lifecycle, not beside it.</strong> Cisco's 2018 privacy benchmark (9,500 executives across 122 countries) found that privacy-mature organisations experienced sales delays of 3.4 weeks, compared to 16.8 weeks for privacy-immature organisations. The pattern is consistent across multiple years of Cisco data: organisations where governance review is part of the design process perform better than those where it is a gate at the end. For AI: human oversight works when it is part of the deployment decision, not a sign-off after it.</p>

  <p><strong>2. Give the oversight function structural authority, not just advisory capacity.</strong> The EDPB coordinated enforcement action on DPOs (2023, 17,490 respondents across 25 EEA authorities) found that in four Member States, more than 30% of DPOs do not report to highest management. DPOs frequently received instructions about task performance and were often not told why organisations deviated from their recommendations. Where structural authority is absent, governance is systematically weaker. For AI: the person responsible for Article 14 oversight needs the authority to halt a deployment without escalating through multiple management layers.</p>

  <p><strong>3. Map the AI value chain before governing it.</strong> This is where AI governance diverges from privacy governance. Under GDPR, most organisations were both the controller and the primary processor. Under the AI Act, deployers use systems built by providers, running on foundation models from separate companies, potentially fine-tuned by consultancies and integrated by systems integrators. Article 26 requires deployers to use systems in accordance with instructions for use, ensure input data relevance, and monitor operation. None of this is possible without visibility across the full value chain. Before governance can function, the organisation needs to map: which AI systems exist, who built them, what documentation accompanies them, where the handoff points are, and who is responsible for what. No GDPR precedent covers this complexity, and no compliance platform automates it. This is the structural mapping that must happen first.</p>

  <h2>Conclusion</h2>

  <p>Attendees will leave with:</p>

  <ol>
    <li>A structural diagnostic framework for identifying where their organisation's AI Act compliance will fail at the organisational layer, not the legal layer.</li>
    <li>A mapping of five structural layers against specific AI Act deployer obligations, grounded in GDPR enforcement evidence and change management research.</li>
    <li>Evidence-based reasoning for why structural investment now reduces total compliance cost, drawn from GDPR's 10-year record and cross-sectional benchmark data.</li>
  </ol>

  <p>This is not a legal summary of the AI Act. Every attendee in the room can read the regulation. This session addresses what the regulation cannot fix: the organisational infrastructure required to sustain compliance over time. It makes the case that AI Act compliance is organisational change at regulatory speed, and that the organisations which treat it as such — drawing on what worked and what failed with GDPR — will be the ones that avoid repeating the same structural failures.</p>

  <hr class="rule">

  <h2>References</h2>

  <ol class="ref-list">
    <li>CloudiFi. "Impacts of GDPR on Global Organisations." 6-year longitudinal analysis, 2018–2024.</li>
    <li>DPA enforcement records. GDPR total fines EUR 7.1 billion. Meta fines EUR 2.8 billion across seven DPA decisions (Irish DPC, CNIL).</li>
    <li>Johnson, G., Shriver, S., Goldberg, S. "Privacy and Market Concentration: Intended and Unintended Consequences of the GDPR." <em>Management Science</em>, 2023.</li>
    <li>LSE Business Review. "Why is GDPR Compliance Still So Difficult?" August 2025.</li>
    <li>CEPS (Centre for European Policy Studies). AI Act Quality Management System cost study.</li>
    <li>EU AI Act (Regulation 2024/1689). Articles 9, 10, 11, 12, 13, 14, 26, 99.</li>
    <li>CEN/CENELEC JTC 21. Harmonised standards development timeline via IAPP.</li>
    <li>IAPP. "European Commission misses deadline for AI Act guidance on high-risk systems." February 2026.</li>
    <li>Cisco. Privacy Maturity Benchmark Studies, 2018–2025. 9,500 executives, 122 countries.</li>
    <li>EDPB. Coordinated Enforcement Action on DPOs. January 2024. 17,490 respondents, 25 EEA authorities.</li>
    <li>Bamberger, K.A. &amp; Mulligan, D.K. (2015). <em>Privacy on the Ground: Driving Corporate Behavior in the United States and Europe.</em> MIT Press.</li>
    <li>Waldman, A.E. (2021). <em>Industry Unbound: The Inside Story of Privacy, Data, and Corporate Power.</em> Cambridge University Press.</li>
    <li>HSTM. Governance Gap Diagnostic assessments, 2026. Internal methodology.</li>
  </ol>
</div>

</body>
</html>
"""

output_path = "/home/junebug/Brain/2. Areas/02 HSTM/Content/Speaking/IAPP Europe Congress 2026/Speaking Proposal A v2.3 - Clean Draft.pdf"

HTML(string=html_content).write_pdf(output_path)
print(f"PDF written to: {output_path}")
