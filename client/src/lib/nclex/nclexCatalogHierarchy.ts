/**
 * Canonical NCLEX content hierarchy for RN/PN tutoring (categories → topics → subtopics).
 * Use labels in Firestore on questions, quizzes, and notes for filtering and admin dropdowns.
 */

export type NclexCatalogSubtopic = { id: string; label: string };
export type NclexCatalogTopic = { id: string; label: string; subtopics: NclexCatalogSubtopic[] };
export type NclexCatalogCategory = { id: string; label: string; topics: NclexCatalogTopic[] };

export const NCLEX_CONTENT_CATALOG: NclexCatalogCategory[] = [
  {
    id: "fundamentals",
    label: "Fundamentals of Nursing",
    topics: [
      {
        id: "basic-concepts",
        label: "Basic Nursing Concepts",
        subtopics: [
          { id: "nursing-process", label: "Nursing process" },
          { id: "therapeutic-relationship", label: "Therapeutic relationship" },
        ],
      },
      {
        id: "procedures",
        label: "Nursing Procedures",
        subtopics: [
          { id: "asepsis", label: "Aseptic technique" },
          { id: "specimen-collection", label: "Specimen collection" },
        ],
      },
      { id: "patient-safety", label: "Patient Safety", subtopics: [{ id: "falls", label: "Fall prevention" }, { id: "restraints", label: "Restraints & alternatives" }] },
      { id: "infection-control", label: "Infection Control", subtopics: [{ id: "isolation", label: "Isolation precautions" }, { id: "ppe", label: "PPE" }] },
      { id: "vital-signs", label: "Vital Signs", subtopics: [{ id: "abnormal-vitals", label: "Abnormal findings" }] },
      { id: "hygiene", label: "Hygiene", subtopics: [{ id: "oral-care", label: "Oral care" }] },
      { id: "positioning", label: "Positioning", subtopics: [{ id: "mobility-devices", label: "Devices & aids" }] },
      { id: "basic-assessment", label: "Basic Assessment", subtopics: [{ id: "head-to-toe", label: "Head-to-toe overview" }] },
    ],
  },
  {
    id: "med-surg",
    label: "Medical-Surgical Nursing",
    topics: [
      { id: "anatomy-physiology", label: "Anatomy and Physiology", subtopics: [{ id: "review", label: "Systems review" }] },
      { id: "msk", label: "Musculoskeletal Disorders", subtopics: [{ id: "fractures", label: "Fractures & casts" }] },
      { id: "cardiovascular", label: "Cardiovascular Disorders", subtopics: [{ id: "hf", label: "Heart failure" }, { id: "mi", label: "MI & ACS" }] },
      { id: "respiratory", label: "Respiratory Disorders", subtopics: [{ id: "copd", label: "COPD" }, { id: "pneumonia", label: "Pneumonia" }] },
      { id: "neuro", label: "Neurological Disorders", subtopics: [{ id: "stroke", label: "Stroke" }, { id: "seizures", label: "Seizures" }] },
      { id: "gi", label: "Gastrointestinal Disorders", subtopics: [{ id: "bowel-obstruction", label: "Bowel obstruction" }] },
      { id: "endocrine", label: "Endocrine Disorders", subtopics: [{ id: "diabetes", label: "Diabetes mellitus" }] },
      { id: "renal", label: "Urinary Disorders", subtopics: [{ id: "aki", label: "Acute kidney injury" }] },
      { id: "reproductive", label: "Reproductive Disorders", subtopics: [{ id: "gyn", label: "Gynecologic" }] },
      { id: "integumentary", label: "Integumentary Disorders", subtopics: [{ id: "wounds", label: "Wound care" }] },
      { id: "burns", label: "Burns", subtopics: [{ id: "burn-stages", label: "Classification & phases" }] },
      { id: "fluid-electrolyte", label: "Fluids and Electrolytes", subtopics: [{ id: "imbalances", label: "Common imbalances" }] },
      { id: "oncology", label: "Oncology", subtopics: [{ id: "chemo-safety", label: "Chemotherapy safety" }] },
      { id: "emergency-ms", label: "Emergency Nursing", subtopics: [{ id: "shock", label: "Shock" }] },
      { id: "perioperative", label: "Perioperative Nursing", subtopics: [{ id: "preop", label: "Preoperative" }] },
    ],
  },
  {
    id: "maternity",
    label: "Maternity Nursing",
    topics: [
      { id: "antepartum", label: "Antepartum Care", subtopics: [{ id: "prenatal-visits", label: "Routine prenatal care" }] },
      { id: "intrapartum", label: "Intrapartum Care", subtopics: [{ id: "labor-stages", label: "Stages of labor" }] },
      { id: "postpartum", label: "Postpartum Care", subtopics: [{ id: "hemorrhage", label: "Postpartum hemorrhage" }] },
      { id: "labor-delivery", label: "Labor and Delivery", subtopics: [{ id: "fhr", label: "FHR patterns" }] },
      { id: "prenatal", label: "Prenatal Care", subtopics: [{ id: "nutrition", label: "Nutrition" }] },
      { id: "ob-complications", label: "Obstetric Complications", subtopics: [{ id: "shoulder-dystocia", label: "Shoulder dystocia" }] },
      { id: "newborn", label: "Newborn Care", subtopics: [{ id: "apgar", label: "APGAR & transition" }] },
      { id: "c-section", label: "Cesarean Birth", subtopics: [{ id: "recovery", label: "Recovery care" }] },
      { id: "preeclampsia", label: "Preeclampsia", subtopics: [{ id: "severe-features", label: "Severe features" }] },
      { id: "placental", label: "Placental Disorders", subtopics: [{ id: "abruption", label: "Abruptio placentae" }] },
    ],
  },
  {
    id: "pediatrics",
    label: "Pediatric Nursing",
    topics: [
      { id: "newborn-peds", label: "Newborn Nursing Care", subtopics: [{ id: "jaundice", label: "Hyperbilirubinemia" }] },
      { id: "growth-dev", label: "Growth and Development", subtopics: [{ id: "milestones", label: "Milestones" }] },
      { id: "peds-disorders", label: "Pediatric Disorders", subtopics: [{ id: "rsv", label: "RSV & respiratory" }] },
      { id: "dev-milestones", label: "Developmental Milestones", subtopics: [{ id: "ages-stages", label: "Ages & stages" }] },
      { id: "childhood-illness", label: "Childhood Illnesses", subtopics: [{ id: "vaccines", label: "Immunizations" }] },
      { id: "peds-emergency", label: "Pediatric Emergencies", subtopics: [{ id: "status-asthmaticus", label: "Status asthmaticus" }] },
    ],
  },
  {
    id: "mental-health",
    label: "Mental Health and Psychiatric Nursing",
    topics: [
      { id: "psych-disorders", label: "Psychiatric Disorders", subtopics: [{ id: "mood", label: "Mood disorders" }] },
      { id: "therapeutic-comm", label: "Therapeutic Communication", subtopics: [{ id: "techniques", label: "Core techniques" }] },
      { id: "behavioral", label: "Behavioral Disorders", subtopics: [{ id: "agitation", label: "Agitation & de-escalation" }] },
      { id: "crisis", label: "Crisis Intervention", subtopics: [{ id: "suicide", label: "Suicide risk" }] },
      { id: "mh-concepts", label: "Mental Health Concepts", subtopics: [{ id: "stigma", label: "Stigma & recovery" }] },
      { id: "substance", label: "Substance Abuse", subtopics: [{ id: "withdrawal", label: "Withdrawal syndromes" }] },
      { id: "stress-coping", label: "Stress and Coping", subtopics: [{ id: "defense", label: "Defense mechanisms" }] },
    ],
  },
  {
    id: "pharmacology",
    label: "Nursing Pharmacology",
    topics: [
      { id: "med-admin", label: "Medication Administration", subtopics: [{ id: "rights", label: "Six / seven rights" }] },
      { id: "dosage-calc", label: "Dosage Calculations", subtopics: [{ id: "dimensional", label: "Dimensional analysis" }] },
      { id: "cv-drugs", label: "Cardiovascular Drugs", subtopics: [{ id: "antihypertensives", label: "Antihypertensives" }] },
      { id: "antibiotics", label: "Antibiotics", subtopics: [{ id: "abx-stewardship", label: "Stewardship basics" }] },
      { id: "neuro-drugs", label: "Neurological Medications", subtopics: [{ id: "anticonvulsants", label: "Anticonvulsants" }] },
      { id: "psych-drugs", label: "Psychiatric Medications", subtopics: [{ id: "antipsychotics", label: "Antipsychotics" }] },
      { id: "resp-drugs", label: "Respiratory Drugs", subtopics: [{ id: "bronchodilators", label: "Bronchodilators" }] },
      { id: "gi-drugs", label: "GI Medications", subtopics: [{ id: "ppi", label: "PPIs & antacids" }] },
      { id: "endo-drugs", label: "Endocrine Medications", subtopics: [{ id: "insulin", label: "Insulin types" }] },
    ],
  },
  {
    id: "leadership",
    label: "Leadership and Management",
    topics: [
      { id: "prioritization", label: "Prioritization", subtopics: [{ id: "maslow-abc", label: "Frameworks" }] },
      { id: "delegation", label: "Delegation", subtopics: [{ id: "nurse-practice-act", label: "Scope & NPA" }] },
      { id: "assignment", label: "Assignment", subtopics: [{ id: "patient-acuity", label: "Acuity" }] },
      { id: "management", label: "Nursing Management", subtopics: [{ id: "quality", label: "Quality & safety" }] },
      { id: "supervision", label: "Supervision", subtopics: [{ id: "new-grad", label: "Supporting new nurses" }] },
      { id: "clinical-judgment", label: "Clinical Judgment", subtopics: [{ id: "ngn-style", label: "NGN-style thinking" }] },
    ],
  },
  {
    id: "emergency",
    label: "Emergency Nursing",
    topics: [
      { id: "triage", label: "Triage", subtopics: [{ id: "esi", label: "ESI levels" }] },
      { id: "emergency-response", label: "Emergency Response", subtopics: [{ id: "codes", label: "Code management" }] },
      { id: "trauma", label: "Trauma", subtopics: [{ id: "primary-survey", label: "Primary survey" }] },
      { id: "critical-situations", label: "Critical Situations", subtopics: [{ id: "resp-arrest", label: "Respiratory arrest" }] },
      { id: "rapid-assessment", label: "Rapid Assessment", subtopics: [{ id: "abcde", label: "ABCDE" }] },
      { id: "immediate-interventions", label: "Immediate Interventions", subtopics: [{ id: "airway", label: "Airway adjuncts" }] },
    ],
  },
  {
    id: "community",
    label: "Community Health Nursing",
    topics: [
      { id: "public-health", label: "Public Health", subtopics: [{ id: "epi", label: "Epidemiology basics" }] },
      { id: "health-promotion", label: "Health Promotion", subtopics: [{ id: "screening", label: "Screening" }] },
      { id: "disease-prevention", label: "Disease Prevention", subtopics: [{ id: "immunization-community", label: "Community immunization" }] },
      { id: "family-health", label: "Family Health", subtopics: [{ id: "home-visits", label: "Home visits" }] },
      { id: "community-care", label: "Community-Based Care", subtopics: [{ id: "chw", label: "Care coordination" }] },
    ],
  },
  {
    id: "special-question-types",
    label: "Special NCLEX Question Types",
    topics: [
      { id: "sata", label: "SATA (Select All That Apply)", subtopics: [{ id: "sata-strategy", label: "Strategies" }] },
      { id: "prioritization-q", label: "Prioritization Questions", subtopics: [{ id: "ordered-response", label: "Ordered response" }] },
      { id: "delegation-q", label: "Delegation Questions", subtopics: [{ id: "assign-task", label: "Who to assign" }] },
      { id: "challenge-exams", label: "Challenge Exams", subtopics: [{ id: "timed-practice", label: "Timed practice" }] },
      { id: "comprehensive-exams", label: "Comprehensive Practice Exams", subtopics: [{ id: "full-length", label: "Full-length simulation" }] },
    ],
  },
];

export const NCLEX_EXAM_LABELS: Record<"rn" | "pn", { title: string; short: string; blurb: string }> = {
  rn: {
    title: "NCLEX-RN",
    short: "Registered Nurse (RN)",
    blurb: "For ADN, BSN, and diploma nursing graduates. Broader scope, leadership, and care planning.",
  },
  pn: {
    title: "NCLEX-PN",
    short: "Practical / Vocational Nurse (PN/LPN/LVN)",
    blurb: "For practical and vocational nursing programs. Bedside care, monitoring, and assisting the care team.",
  },
};
