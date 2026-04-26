import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const category = "Physiological Integrity";
const topic = "Cardiovascular + Priority & Clinical Judgment";

const raw = [
  {
    q: "A 64-year-old patient with a history of hypertension reports sudden chest tightness and shortness of breath. Vital signs: BP 88/58, HR 122, RR 26, SpO₂ 90%.\nWhat is the nurse's priority action?",
    o: [
      "Administer IV beta-blocker",
      "Place the patient in high Fowler's position and apply oxygen",
      "Obtain a 12-lead ECG",
      "Start IV fluids rapidly",
    ],
    a: "b",
    r: "This patient is unstable (hypotension + hypoxia). Priority follows ABCs (Airway, Breathing, Circulation). Oxygenation comes first. Positioning improves lung expansion. ECG is important but not before stabilizing airway/breathing.",
  },
  {
    q: "A patient with heart failure is receiving furosemide. Which finding requires immediate follow-up?",
    o: ["Potassium level 3.1 mEq/L", "Urine output 1200 mL/day", "Blood pressure 130/78 mmHg", "Mild ankle edema"],
    a: "a",
    r: "Furosemide causes potassium loss. A level of 3.1 = hypokalemia, which can trigger fatal arrhythmias. This is priority over stable vitals or mild edema.",
  },
  {
    q: "A patient presents with chest pain radiating to the left arm. Which assessment finding is most concerning?",
    o: ["Pain rated 7/10", "Nausea and vomiting", "Cool, clammy skin", "Anxiety"],
    a: "c",
    r: "Cool, clammy skin = poor perfusion + sympathetic response, often seen in shock or acute MI. This indicates worsening condition and requires urgent attention.",
  },
  {
    q: "A patient with atrial fibrillation is at highest risk for which complication?",
    o: ["Myocardial hypertrophy", "Pulmonary embolism", "Stroke", "Heart block"],
    a: "c",
    r: "Atrial fibrillation causes blood pooling in atria → clot formation → embolization → stroke. This is the most common and dangerous complication.",
  },
  {
    q: "A nurse is caring for a patient post-cardiac catheterization. Which finding requires immediate intervention?",
    o: [
      "Small amount of bleeding at insertion site",
      "BP 118/76 mmHg",
      "Absent distal pulses in the affected limb",
      "Patient reports mild discomfort",
    ],
    a: "c",
    r: "Absent pulses = possible arterial occlusion → risk of limb ischemia. This is an emergency. Mild bleeding and discomfort are expected.",
  },
  {
    q: "A patient with suspected myocardial infarction is prescribed morphine. What is the primary purpose of this medication?",
    o: ["Reduce heart rate", "Decrease preload and relieve pain", "Prevent clot formation", "Increase oxygen saturation"],
    a: "b",
    r: "Morphine relieves pain and reduces preload (vasodilation), decreasing cardiac workload. It does not prevent clots (that is anticoagulants/antiplatelets).",
  },
  {
    q: "A patient with hypertension suddenly develops a severe headache and blurred vision. What should the nurse suspect first?",
    o: ["Stroke", "Hypertensive crisis", "Migraine", "Anxiety attack"],
    a: "b",
    r: "Severe headache + visual changes + hypertension = hypertensive crisis. This can quickly lead to stroke if untreated, so it is the most immediate concern.",
  },
  {
    q: "Which patient should the nurse assess first?",
    o: [
      "Patient with BP 150/90 complaining of headache",
      "Patient with chest pain relieved by rest",
      "Patient with HR 110 after walking",
      "Patient with sudden onset chest pain and diaphoresis",
    ],
    a: "d",
    r: "Sudden chest pain + diaphoresis = possible acute MI → life-threatening. Always prioritize unstable, acute, life-threatening conditions.",
  },
  {
    q: "A patient with heart failure is on fluid restriction. Which statement indicates understanding?",
    o: [
      "I can drink as much as I want if I feel thirsty.",
      "I will track all fluids including soups and fruits.",
      "Only water counts toward fluid intake.",
      "Fluid restriction is not important if I take my meds.",
    ],
    a: "b",
    r: "All fluids count toward the restriction—including water, soups, gelatin, ice, and high-water-content fruits (e.g., watermelon). Option B shows correct understanding.",
  },
  {
    q: "A patient is receiving nitroglycerin for chest pain. Which finding indicates the medication is effective?",
    o: ["Decreased blood pressure", "Relief of chest pain", "Increased heart rate", "Flushing of the skin"],
    a: "b",
    r: "The goal of nitroglycerin is to relieve chest pain (angina). Side effects like hypotension or flushing do not indicate therapeutic effectiveness.",
  },
  {
    q: "A patient with heart failure reports sudden weight gain of 2 kg (4.4 lbs) in 2 days. What is the nurse's best action?",
    o: ["Reassure the patient this is normal", "Restrict sodium intake only", "Notify the provider", "Encourage increased activity"],
    a: "c",
    r: "Rapid weight gain indicates fluid retention → worsening heart failure → requires provider intervention.",
  },
  {
    q: "A patient with chest pain is given oxygen. What finding indicates improvement?",
    o: ["HR decreases from 110 to 105", "SpO₂ increases from 90% to 96%", "BP decreases slightly", "Patient appears calmer"],
    a: "b",
    r: "Oxygen therapy effectiveness is measured by improved oxygen saturation.",
  },
  {
    q: "A patient is taking digoxin. Which finding suggests toxicity?",
    o: ["HR 88 bpm", "Nausea and blurred vision", "BP 130/80", "Mild fatigue"],
    a: "b",
    r: "Classic digoxin toxicity signs: GI symptoms + visual disturbances (yellow/blurred vision).",
  },
  {
    q: "Which electrolyte imbalance increases the risk of digoxin toxicity?",
    o: ["Hyperkalemia", "Hypokalemia", "Hypernatremia", "Hypercalcemia"],
    a: "b",
    r: "Low potassium enhances digoxin effects, increasing toxicity risk.",
  },
  {
    q: "A patient with MI is ordered aspirin. What is the primary purpose?",
    o: ["Reduce pain", "Lower blood pressure", "Prevent platelet aggregation", "Increase oxygen delivery"],
    a: "c",
    r: "Aspirin prevents clot expansion by inhibiting platelets.",
  },
  {
    q: "A patient suddenly develops shortness of breath after being on bed rest for days. What is the priority suspicion?",
    o: ["Heart failure", "Pneumonia", "Pulmonary embolism", "Anxiety"],
    a: "c",
    r: "Sudden dyspnea + immobility = PE until proven otherwise.",
  },
  {
    q: "Which finding in a patient with heart failure requires immediate intervention?",
    o: ["Mild edema", "Crackles in lungs", "Weight gain of 0.5 kg", "BP 128/82"],
    a: "b",
    r: "Crackles = fluid in lungs → impaired gas exchange → priority (breathing).",
  },
  {
    q: "A patient is on heparin therapy. Which lab value is most important?",
    o: ["INR", "Platelet count", "aPTT", "Hemoglobin"],
    a: "c",
    r: "Heparin is monitored using aPTT.",
  },
  {
    q: "A patient receiving warfarin should be monitored using which test?",
    o: ["aPTT", "INR", "Platelet count", "Sodium levels"],
    a: "b",
    r: "Warfarin effectiveness is monitored using INR.",
  },
  {
    q: "A patient complains of chest pain. Which question is most important initially?",
    o: [
      "Have you eaten today?",
      "Where is the pain located?",
      "Do you exercise regularly?",
      "What medications do you take?",
    ],
    a: "b",
    r: "Pain assessment (location, quality) is the first step in evaluation.",
  },
  {
    q: "A patient has BP 180/110 with no symptoms. What is the priority?",
    o: ["Immediate IV medication", "Monitor and reassess", "Call emergency response", "Give oxygen"],
    a: "b",
    r: "No symptoms = hypertensive urgency, not emergency → monitor first.",
  },
  {
    q: "A patient with MI develops ventricular fibrillation. What is the priority action?",
    o: ["Administer oxygen", "Start IV fluids", "Defibrillate", "Give pain medication"],
    a: "c",
    r: "VF = cardiac arrest rhythm → immediate defibrillation.",
  },
  {
    q: "A patient has peripheral edema. Which assessment is most relevant?",
    o: ["Lung sounds", "Skin temperature", "Bowel sounds", "Vision"],
    a: "a",
    r: "Edema may indicate fluid overload → check lungs for congestion.",
  },
  {
    q: "A patient with angina is prescribed nitroglycerin. What instruction is correct?",
    o: ["Swallow the tablet whole", "Take only after meals", "Place under tongue", "Take with water"],
    a: "c",
    r: "Nitroglycerin is sublingual for rapid absorption.",
  },
  {
    q: "Which symptom is most indicative of left-sided heart failure?",
    o: ["Peripheral edema", "Jugular vein distention", "Pulmonary crackles", "Ascites"],
    a: "c",
    r: "Left HF → lung congestion → crackles.",
  },
  {
    q: "A patient with DVT is at risk for which complication?",
    o: ["Stroke", "Pulmonary embolism", "Myocardial infarction", "Heart failure"],
    a: "b",
    r: "Clot can travel → lungs → PE.",
  },
  {
    q: "A patient has HR 48 bpm and dizziness. What is the priority?",
    o: ["Monitor", "Administer atropine", "Encourage fluids", "Reassure patient"],
    a: "b",
    r: "Symptomatic bradycardia → atropine is first-line per ACLS-style management.",
  },
  {
    q: "Which finding suggests cardiogenic shock?",
    o: ["Warm skin", "High urine output", "Low BP and weak pulses", "Increased appetite"],
    a: "c",
    r: "Cardiogenic shock = poor perfusion → hypotension + weak pulses.",
  },
  {
    q: "A patient is on beta-blockers. What should the nurse monitor?",
    o: ["Blood glucose", "Heart rate", "Oxygen saturation", "Urine output"],
    a: "b",
    r: "Beta-blockers reduce heart rate; risk of bradycardia.",
  },
  {
    q: "Which patient teaching is most important after MI?",
    o: [
      "Increase physical activity immediately",
      "Stop medications when feeling better",
      "Adhere to medication and lifestyle changes",
      "Avoid all physical movement",
    ],
    a: "c",
    r: "Long-term survival depends on medication adherence + lifestyle modification.",
  },
  {
    q: "A patient with acute MI is receiving oxygen, aspirin, and nitroglycerin. BP drops from 130/80 to 88/54 after nitroglycerin. What is the priority action?",
    o: ["Continue nitroglycerin", "Place patient in Trendelenburg", "Stop nitroglycerin and notify provider", "Administer morphine"],
    a: "c",
    r: "Nitroglycerin causes vasodilation → hypotension. Significant BP drop = stop drug and notify provider.",
  },
  {
    q: "A patient with heart failure has crackles, JVD, and BP 92/60. Which action is most appropriate?",
    o: ["Administer IV fluids", "Give diuretics as prescribed", "Encourage oral fluids", "Place in supine position"],
    a: "b",
    r: "Signs of fluid overload despite low BP → diuretics relieve congestion; fluids would worsen overload.",
  },
  {
    q: "Which patient requires immediate intervention?",
    o: ["HR 52 bpm, asymptomatic", "BP 140/90 with headache", "Chest pain + ST elevation + diaphoresis", "Mild ankle swelling"],
    a: "c",
    r: "STEMI signs = life-threatening emergency → immediate action.",
  },
  {
    q: "A patient on warfarin has INR of 5.2. What is the priority?",
    o: ["Continue medication", "Administer vitamin K", "Increase dose", "Encourage exercise"],
    a: "b",
    r: "High INR = bleeding risk → antidote (vitamin K) per orders.",
  },
  {
    q: "A patient with DVT suddenly develops chest pain and dyspnea. What is the first action?",
    o: ["Start anticoagulant", "Assess oxygen saturation", "Call provider", "Position supine"],
    a: "b",
    r: "Assess airway/breathing first (oxygenation) before other interventions.",
  },
  {
    q: "A patient with digoxin therapy has HR 54 bpm. What should the nurse do?",
    o: ["Administer medication", "Hold medication and notify provider", "Double the dose", "Monitor later"],
    a: "b",
    r: "Digoxin is often held if HR < 60 bpm (per agency policy) due to bradycardia risk.",
  },
  {
    q: "A patient post-MI reports increasing chest pain unrelieved by nitroglycerin. What is the priority interpretation?",
    o: ["Medication failure", "Anxiety", "Reinfarction", "Muscle strain"],
    a: "c",
    r: "Persistent pain after treatment = possible reinfarction → emergency evaluation.",
  },
  {
    q: "A patient with heart failure has decreased urine output and rising creatinine. What does this indicate?",
    o: ["Improvement", "Renal hypoperfusion", "Dehydration", "Infection"],
    a: "b",
    r: "HF reduces cardiac output → kidney perfusion drops → renal impairment.",
  },
  {
    q: "Which intervention is highest priority for a patient with ventricular tachycardia and pulse?",
    o: ["CPR", "Defibrillation", "Antiarrhythmic medication", "Oxygen only"],
    a: "c",
    r: "VT with a pulse is treated with antiarrhythmics (e.g., amiodarone); CPR/defibrillation apply to pulseless arrest rhythms.",
  },
  {
    q: "A patient receiving heparin develops platelet count drop. What should the nurse suspect?",
    o: ["Anemia", "HIT (Heparin-Induced Thrombocytopenia)", "Infection", "Dehydration"],
    a: "b",
    r: "Heparin can cause HIT → paradoxical clotting risk; notify provider.",
  },
  {
    q: "Which patient should be seen first?",
    o: ["Stable angina relieved by rest", "BP 160/100 no symptoms", "Sudden chest pain + hypotension", "Mild fatigue"],
    a: "c",
    r: "Hypotension + chest pain = unstable → priority.",
  },
  {
    q: "A patient with cardiogenic shock shows which finding?",
    o: ["Warm, flushed skin", "High BP", "Cold, clammy skin", "Increased urine output"],
    a: "c",
    r: "Poor perfusion → cool, clammy skin.",
  },
  {
    q: "A patient with pericardial tamponade would show:",
    o: ["High BP", "Narrow pulse pressure", "Increased urine output", "Warm skin"],
    a: "b",
    r: "Tamponade restricts filling → narrow pulse pressure (and Beck triad findings).",
  },
  {
    q: "A patient with MI develops sudden confusion. What is the priority concern?",
    o: ["Anxiety", "Hypoxia", "Fatigue", "Medication side effect"],
    a: "b",
    r: "Confusion may indicate hypoxia or reduced perfusion → assess oxygenation urgently.",
  },
  {
    q: "Which lab value is most critical in MI?",
    o: ["Hemoglobin", "Troponin", "Sodium", "Calcium"],
    a: "b",
    r: "Troponin is a specific marker for cardiac injury.",
  },
  {
    q: "A patient with heart failure is taking ACE inhibitors. What side effect requires attention?",
    o: ["Dry cough", "Increased appetite", "Weight gain", "Sweating"],
    a: "a",
    r: "ACE inhibitors commonly cause a persistent dry cough; report to provider.",
  },
  {
    q: "A patient develops sudden sharp chest pain that worsens with breathing. Likely cause?",
    o: ["MI", "Pulmonary embolism", "Heart failure", "Angina"],
    a: "b",
    r: "Pleuritic chest pain worsening with inspiration suggests PE among differentials.",
  },
  {
    q: "Which patient requires immediate intervention?",
    o: ["BP 150/90", "HR 58 asymptomatic", "Chest pain + oxygen saturation 85%", "Mild fatigue"],
    a: "c",
    r: "Low SpO₂ with chest pain = oxygenation emergency.",
  },
  {
    q: "A patient on beta-blockers reports dizziness. What is the likely cause?",
    o: ["Hypertension", "Bradycardia", "Infection", "Dehydration"],
    a: "b",
    r: "Beta-blockers decrease HR; dizziness may reflect bradycardia or low output.",
  },
  {
    q: "A nurse is caring for four patients. Which task can be delegated to a UAP?",
    o: ["Assess chest pain", "Monitor ECG changes", "Measure vital signs", "Evaluate medication response"],
    a: "c",
    r: "UAP may perform stable routine tasks such as vitals; assessments and ECG interpretation stay with the nurse.",
  },
];

if (raw.length !== 50) {
  console.error("Expected 50 questions, got", raw.length);
  process.exit(1);
}

const labels = ["a", "b", "c", "d"];

const out = {
  exportVersion: 1,
  description:
    "Corrected 50-item bank: Physiological Integrity / Cardiovascular + Priority & Clinical Judgment. Duplicates removed; Q9 rationale corrected. Compatible with Firestore question shape.",
  category,
  topic,
  questions: raw.map((x) => ({
    title: "",
    questionText: x.q,
    options: labels.map((id, j) => ({ id, text: x.o[j] })),
    correctAnswerId: x.a,
    rationale: x.r,
    category,
    topic,
    isActive: true,
  })),
};

const pub = path.join(root, "client", "public", "nclex-cardiovascular-corrected.json");
const dataDir = path.join(root, "data", "nclex-cardiovascular-corrected.json");
fs.mkdirSync(path.dirname(pub), { recursive: true });
fs.mkdirSync(path.dirname(dataDir), { recursive: true });
const json = JSON.stringify(out, null, 2);
fs.writeFileSync(pub, json, "utf8");
fs.writeFileSync(dataDir, json, "utf8");
console.log("Wrote", pub);
console.log("Wrote", dataDir);
