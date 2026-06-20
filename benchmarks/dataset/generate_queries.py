"""Generate eu_ai_act_queries.json — 150 retrieval-grounded queries."""

from __future__ import annotations

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

QUERIES: list[dict] = []


def add(qid: str, query: str, difficulty: str, band: str,
        articles: list[str], notes: str = "",
        chunks: list[str] | None = None) -> None:
    QUERIES.append({
        "id": qid,
        "query": query,
        "difficulty": difficulty,
        "confidence_band": band,
        "expected_articles": articles,
        "expected_chunks": chunks,
        "corpus_ref": "EU_AI_Act.pdf",
        "notes": notes,
    })


# ======================================================================
# SIMPLE — single article lookup, direct definition, factual retrieval
# ======================================================================

SIMPLE_NOTES = "Direct lookup — single article reference."

add("SIMPLE-001", "What is the definition of an 'AI system' according to Article 3(1)?",
    "simple", "high", ["Article 3(1)"], SIMPLE_NOTES)
add("SIMPLE-002", "According to Article 5, what is prohibited regarding subliminal manipulation?",
    "simple", "high", ["Article 5(a)"], SIMPLE_NOTES)
add("SIMPLE-003", "What does Article 5(c) say about social scoring by public authorities?",
    "simple", "high", ["Article 5(c)"], SIMPLE_NOTES)
add("SIMPLE-004", "Under Article 50, what transparency obligation applies to AI systems that interact with humans?",
    "simple", "high", ["Article 50(1)"], SIMPLE_NOTES)
add("SIMPLE-005", "What is the penalty for non-compliance with prohibited AI practices under Article 99?",
    "simple", "high", ["Article 99(1)"], SIMPLE_NOTES)
add("SIMPLE-006", "According to Article 6(1), when is an AI system considered high-risk due to product safety?",
    "simple", "high", ["Article 6(1)"], SIMPLE_NOTES)
add("SIMPLE-007", "What does Article 9 require regarding risk management for high-risk AI systems?",
    "simple", "high", ["Article 9"], SIMPLE_NOTES)
add("SIMPLE-008", "Under Article 10, what data governance requirements apply to high-risk AI systems?",
    "simple", "high", ["Article 10"], SIMPLE_NOTES)
add("SIMPLE-009", "What technical documentation must be drawn up according to Article 11?",
    "simple", "high", ["Article 11"], SIMPLE_NOTES)
add("SIMPLE-010", "What does Article 12 require concerning record-keeping and logging?",
    "simple", "high", ["Article 12"], SIMPLE_NOTES)
add("SIMPLE-011", "According to Article 14, what human oversight measures must be in place for high-risk AI?",
    "simple", "high", ["Article 14"], SIMPLE_NOTES)
add("SIMPLE-012", "What accuracy, robustness, and cybersecurity requirements are specified in Article 15?",
    "simple", "high", ["Article 15"], SIMPLE_NOTES)
add("SIMPLE-013", "List the obligations of providers of high-risk AI systems under Article 16.",
    "simple", "high", ["Article 16"], SIMPLE_NOTES)
add("SIMPLE-014", "What must a quality management system for high-risk AI include per Article 17?",
    "simple", "high", ["Article 17"], SIMPLE_NOTES)
add("SIMPLE-015", "According to Article 22, what is the role of an authorised representative?",
    "simple", "high", ["Article 22"], SIMPLE_NOTES)
add("SIMPLE-016", "What obligations do importers of high-risk AI systems have under Article 23?",
    "simple", "high", ["Article 23"], SIMPLE_NOTES)
add("SIMPLE-017", "What obligations do distributors have under Article 24?",
    "simple", "high", ["Article 24"], SIMPLE_NOTES)
add("SIMPLE-018", "Under Article 26, what are the obligations of deployers of high-risk AI systems?",
    "simple", "high", ["Article 26"], SIMPLE_NOTES)
add("SIMPLE-019", "What is the purpose of a fundamental rights impact assessment under Article 27?",
    "simple", "high", ["Article 27"], SIMPLE_NOTES)
add("SIMPLE-020", "According to Article 51, how is a general-purpose AI model classified as having systemic risk?",
    "simple", "high", ["Article 51"], SIMPLE_NOTES)
add("SIMPLE-021", "What obligations apply to providers of general-purpose AI models under Article 53?",
    "simple", "high", ["Article 53"], SIMPLE_NOTES)
add("SIMPLE-022", "Under Article 55, what additional obligations apply to providers of general-purpose AI with systemic risk?",
    "simple", "high", ["Article 55"], SIMPLE_NOTES)
add("SIMPLE-023", "What is an AI regulatory sandbox according to Article 57?",
    "simple", "high", ["Article 57"], SIMPLE_NOTES)
add("SIMPLE-024", "What tasks are assigned to the AI Office under Article 64?",
    "simple", "high", ["Article 64"], SIMPLE_NOTES)
add("SIMPLE-025", "How is the European Artificial Intelligence Board established according to Article 65?",
    "simple", "high", ["Article 65"], SIMPLE_NOTES)
add("SIMPLE-026", "What are the tasks of the European AI Board under Article 66?",
    "simple", "high", ["Article 66"], SIMPLE_NOTES)
add("SIMPLE-027", "According to Article 70, what must Member States designate regarding national authorities?",
    "simple", "high", ["Article 70"], SIMPLE_NOTES)
add("SIMPLE-028", "What information must be registered in the EU database for high-risk AI systems per Article 71?",
    "simple", "high", ["Article 71"], SIMPLE_NOTES)
add("SIMPLE-029", "What does Article 86 provide regarding the right to explanation of individual decision-making?",
    "simple", "high", ["Article 86"], SIMPLE_NOTES)
add("SIMPLE-030", "Under Article 95, what is the purpose of codes of conduct for voluntary application?",
    "simple", "high", ["Article 95"], SIMPLE_NOTES)
add("SIMPLE-031", "According to Article 113, what is the general date of application of the AI Act?",
    "simple", "high", ["Article 113"], SIMPLE_NOTES)
add("SIMPLE-032", "What does Article 4 require concerning AI literacy?",
    "simple", "high", ["Article 4"], SIMPLE_NOTES)
add("SIMPLE-033", "Under Article 2, what is excluded from the scope of the AI Act?",
    "simple", "high", ["Article 2"], SIMPLE_NOTES)
add("SIMPLE-034", "What does Article 40 say about harmonised standards for high-risk AI systems?",
    "simple", "high", ["Article 40"], SIMPLE_NOTES)
add("SIMPLE-035", "According to Article 42, what is the presumption of conformity with harmonised standards?",
    "simple", "high", ["Article 42"], SIMPLE_NOTES)
add("SIMPLE-036", "What does Article 47 require concerning CE marking of high-risk AI systems?",
    "simple", "high", ["Article 47"], SIMPLE_NOTES)
add("SIMPLE-037", "Under Article 59, what conditions apply to further processing of personal data in the public interest?",
    "simple", "high", ["Article 59"], SIMPLE_NOTES)
add("SIMPLE-038", "What measures for SMEs and start-ups are listed in Article 62?",
    "simple", "high", ["Article 62"], SIMPLE_NOTES)
add("SIMPLE-039", "According to Article 72, what post-market monitoring must providers carry out?",
    "simple", "high", ["Article 72"], SIMPLE_NOTES)
add("SIMPLE-040", "Under Article 78, what serious incident reporting obligations apply?",
    "simple", "high", ["Article 78"], SIMPLE_NOTES)
add("SIMPLE-041", "What does Article 99(3) specify about administrative fines on Union institutions?",
    "simple", "high", ["Article 99(3)"], SIMPLE_NOTES)
add("SIMPLE-042", "According to Article 101, what fines apply to providers of general-purpose AI models?",
    "simple", "high", ["Article 101"], SIMPLE_NOTES)
add("SIMPLE-043", "What does Article 13 require concerning transparency and provision of information to deployers?",
    "simple", "high", ["Article 13"], SIMPLE_NOTES)
add("SIMPLE-044", "Under Article 5(g), what biometric categorisation practices are prohibited?",
    "simple", "high", ["Article 5(g)"], SIMPLE_NOTES)
add("SIMPLE-045", "According to Article 5(h), when can real-time remote biometric identification be used by law enforcement?",
    "simple", "high", ["Article 5(h)"], SIMPLE_NOTES)
add("SIMPLE-046", "What does Article 3(4) define as 'provider' of an AI system?",
    "simple", "high", ["Article 3(4)"], SIMPLE_NOTES)
add("SIMPLE-047", "Under Article 3(8), what is a 'deployer' of an AI system?",
    "simple", "high", ["Article 3(8)"], SIMPLE_NOTES)
add("SIMPLE-048", "According to Article 57(1), by when must Member States establish AI regulatory sandboxes?",
    "simple", "high", ["Article 57(1)"], SIMPLE_NOTES)
add("SIMPLE-049", "What does Article 111 say about AI systems already placed on the market?",
    "simple", "high", ["Article 111"], SIMPLE_NOTES)
add("SIMPLE-050", "Under Article 112, when must the Commission evaluate and review the AI Act?",
    "simple", "high", ["Article 112"], SIMPLE_NOTES)

# ======================================================================
# COMPLEX — synthesis across 2-3 articles
# ======================================================================

COMPLEX_NOTES = "Synthesis required — multiple articles must be combined."

add("COMPLEX-001",
    "Compare the obligations of providers (Article 16) with those of deployers (Article 26) for high-risk AI.",
    "complex", "medium", ["Article 16", "Article 26"], COMPLEX_NOTES)
add("COMPLEX-002",
    "How do the transparency requirements in Article 50 differ for chatbots versus deep fakes?",
    "complex", "medium", ["Article 50(1)", "Article 50(2)"], COMPLEX_NOTES)
add("COMPLEX-003",
    "What is the relationship between risk management (Article 9) and data governance (Article 10)?",
    "complex", "medium", ["Article 9", "Article 10"], COMPLEX_NOTES)
add("COMPLEX-004",
    "How do Articles 6 and Annex III together determine whether an AI system is high-risk?",
    "complex", "medium", ["Article 6", "Annex III"], COMPLEX_NOTES)
add("COMPLEX-005",
    "Compare the obligations for general-purpose AI providers under Article 53 with the additional requirements under Article 55 for systemic risk models.",
    "complex", "medium", ["Article 53", "Article 55"], COMPLEX_NOTES)
add("COMPLEX-006",
    "According to Article 57 and Article 58, what are the key features and arrangements for AI regulatory sandboxes?",
    "complex", "medium", ["Article 57", "Article 58"], COMPLEX_NOTES)
add("COMPLEX-007",
    "How do the roles of the AI Office (Article 64) and the European AI Board (Articles 65-66) complement each other in governance?",
    "complex", "medium", ["Article 64", "Article 65", "Article 66"], COMPLEX_NOTES)
add("COMPLEX-008",
    "What is the penalty structure under Article 99 for different types of infringements of the AI Act?",
    "complex", "medium", ["Article 99(1)", "Article 99(2)", "Article 99(3)"], COMPLEX_NOTES)
add("COMPLEX-009",
    "How do the obligations of importers (Article 23) and distributors (Article 24) compare under the AI Act?",
    "complex", "medium", ["Article 23", "Article 24"], COMPLEX_NOTES)
add("COMPLEX-010",
    "What is the interplay between Article 5's prohibitions on biometric categorisation and Article 50's transparency requirements for emotion recognition?",
    "complex", "medium", ["Article 5(g)", "Article 5(f)", "Article 50"], COMPLEX_NOTES)
add("COMPLEX-011",
    "Compare the documentation requirements under Article 11 (technical documentation) with Article 18 (documentation keeping).",
    "complex", "medium", ["Article 11", "Article 18"], COMPLEX_NOTES)
add("COMPLEX-012",
    "How do Articles 59 and 60 together enable testing of high-risk AI systems in real-world conditions?",
    "complex", "medium", ["Article 59", "Article 60"], COMPLEX_NOTES)
add("COMPLEX-013",
    "What are the requirements for human oversight (Article 14) and how do they relate to accuracy and robustness (Article 15)?",
    "complex", "medium", ["Article 14", "Article 15"], COMPLEX_NOTES)
add("COMPLEX-014",
    "According to Articles 22 and 25, what happens when responsibilities shift along the AI value chain?",
    "complex", "medium", ["Article 22", "Article 25"], COMPLEX_NOTES)
add("COMPLEX-015",
    "How do Articles 72 (post-market monitoring) and 78 (serious incident reporting) together ensure ongoing safety of high-risk AI?",
    "complex", "medium", ["Article 72", "Article 78"], COMPLEX_NOTES)
add("COMPLEX-016",
    "Compare the penalties in Article 99 for AI Act infringements with the fines for general-purpose AI model providers in Article 101.",
    "complex", "medium", ["Article 99", "Article 101"], COMPLEX_NOTES)
add("COMPLEX-017",
    "What are the data governance requirements under Article 10 and how do they relate to bias detection and correction?",
    "complex", "medium", ["Article 10"], COMPLEX_NOTES)
add("COMPLEX-018",
    "How does Article 27 (fundamental rights impact assessment) interact with Article 26 (obligations of deployers)?",
    "complex", "medium", ["Article 27", "Article 26"], COMPLEX_NOTES)
add("COMPLEX-019",
    "According to Article 51 and Annex XIII, what criteria determine whether a general-purpose AI model has systemic risk?",
    "complex", "medium", ["Article 51", "Annex XIII"], COMPLEX_NOTES)
add("COMPLEX-020",
    "Compare the obligations for notified bodies under Articles 34-38 with the requirements for notifying authorities under Articles 28-30.",
    "complex", "medium", ["Article 34", "Article 35", "Article 36", "Article 37", "Article 38", "Article 28", "Article 29", "Article 30"], COMPLEX_NOTES)
add("COMPLEX-021",
    "How do the conformity assessment procedures in Article 43 differ depending on the type of high-risk AI system?",
    "complex", "medium", ["Article 43"], COMPLEX_NOTES)
add("COMPLEX-022",
    "What does Article 3 define as 'biometric data', 'biometric categorisation', and 'biometric identification'?",
    "complex", "medium", ["Article 3(9)", "Article 3(10)", "Article 3(11)"], COMPLEX_NOTES)
add("COMPLEX-023",
    "According to Articles 46 and 47, what are the rules for EU declaration of conformity and CE marking?",
    "complex", "medium", ["Article 46", "Article 47"], COMPLEX_NOTES)
add("COMPLEX-024",
    "How do Articles 62 and 63 support SMEs and start-ups in complying with the AI Act?",
    "complex", "medium", ["Article 62", "Article 63"], COMPLEX_NOTES)
add("COMPLEX-025",
    "Compare the post-market monitoring obligations under Article 72 with the market surveillance powers under Articles 74-76.",
    "complex", "medium", ["Article 72", "Article 74", "Article 75", "Article 76"], COMPLEX_NOTES)
add("COMPLEX-026",
    "How does the right to explanation under Article 86 relate to the transparency obligations under Article 13?",
    "complex", "medium", ["Article 86", "Article 13"], COMPLEX_NOTES)
add("COMPLEX-027",
    "What are the requirements for AI literacy under Article 4 and who bears responsibility for ensuring it?",
    "complex", "medium", ["Article 4"], COMPLEX_NOTES)
add("COMPLEX-028",
    "According to Articles 97 and 98, how does the Commission exercise delegated powers and committee procedures?",
    "complex", "medium", ["Article 97", "Article 98"], COMPLEX_NOTES)
add("COMPLEX-029",
    "What amendments to existing Union legislation are introduced by Articles 102 through 110?",
    "complex", "medium", ["Article 102", "Article 103", "Article 104", "Article 105", "Article 106", "Article 107", "Article 108", "Article 109", "Article 110"], COMPLEX_NOTES)
add("COMPLEX-030",
    "Compare the scope exclusions in Article 2 with the extraterritorial application provisions.",
    "complex", "medium", ["Article 2"], COMPLEX_NOTES)
add("COMPLEX-031",
    "How do the codes of practice under Article 56 for general-purpose AI models relate to the codes of conduct under Article 95?",
    "complex", "medium", ["Article 56", "Article 95"], COMPLEX_NOTES)
add("COMPLEX-032",
    "According to Articles 67 and 68, what are the roles of the Advisory Forum and the Scientific Panel?",
    "complex", "medium", ["Article 67", "Article 68"], COMPLEX_NOTES)
add("COMPLEX-033",
    "How do the corrective actions (Article 20) and duty of information (Article 21) work together for non-compliant high-risk AI?",
    "complex", "medium", ["Article 20", "Article 21"], COMPLEX_NOTES)
add("COMPLEX-034",
    "What are the requirements for automatically generated logs under Article 19 and how long must they be kept per Article 18?",
    "complex", "medium", ["Article 19", "Article 18"], COMPLEX_NOTES)
add("COMPLEX-035",
    "Compare the rules for general-purpose AI models under Chapter V (Articles 51-56) with the rules for high-risk AI systems under Chapter III (Articles 6-49).",
    "complex", "medium", ["Article 51", "Article 52", "Article 53", "Article 54", "Article 55", "Article 56", "Article 6", "Article 8", "Article 9"], COMPLEX_NOTES)
add("COMPLEX-036",
    "According to Articles 11 and Annex IV, what must the technical documentation for high-risk AI systems include?",
    "complex", "medium", ["Article 11", "Annex IV"], COMPLEX_NOTES)
add("COMPLEX-037",
    "How do the obligations for providers (Article 16) interact with the quality management system requirements (Article 17)?",
    "complex", "medium", ["Article 16", "Article 17"], COMPLEX_NOTES)
add("COMPLEX-038",
    "Under Article 25, when does a distributor, importer, deployer, or other third party become a provider?",
    "complex", "medium", ["Article 25"], COMPLEX_NOTES)
add("COMPLEX-039",
    "What rules apply to real-world testing of high-risk AI systems under Articles 60-61 outside sandboxes?",
    "complex", "medium", ["Article 60", "Article 61"], COMPLEX_NOTES)
add("COMPLEX-040",
    "According to Articles 84 and 85, what are the powers of market surveillance authorities regarding AI systems?",
    "complex", "medium", ["Article 84", "Article 85"], COMPLEX_NOTES)
add("COMPLEX-041",
    "Compare the enforcement provisions for general-purpose AI model providers under Articles 88-94 with those for high-risk AI systems under Articles 79-83.",
    "complex", "medium", ["Article 88", "Article 89", "Article 90", "Article 91", "Article 92", "Article 93", "Article 94", "Article 79", "Article 80", "Article 81", "Article 82", "Article 83"], COMPLEX_NOTES)
add("COMPLEX-042",
    "How does Article 96 empower the Commission to issue guidelines on implementing the AI Act?",
    "complex", "medium", ["Article 96"], COMPLEX_NOTES)
add("COMPLEX-043",
    "What does Article 3 define as 'substantial modification' of an AI system and why is it important?",
    "complex", "medium", ["Article 3(23)"], COMPLEX_NOTES)
add("COMPLEX-044",
    "According to Articles 28-30, what are the requirements for notifying authorities and notified bodies?",
    "complex", "medium", ["Article 28", "Article 29", "Article 30"], COMPLEX_NOTES)
add("COMPLEX-045",
    "How do Articles 31-33 govern the process for notified bodies to demonstrate and maintain competence?",
    "complex", "medium", ["Article 31", "Article 32", "Article 33"], COMPLEX_NOTES)
add("COMPLEX-046",
    "Compare the information requirements for registration of high-risk AI systems under Annexes VIII and IX.",
    "complex", "medium", ["Annex VIII", "Annex IX"], COMPLEX_NOTES)
add("COMPLEX-047",
    "According to Article 113, what are the staggered application dates for different provisions of the AI Act?",
    "complex", "medium", ["Article 113"], COMPLEX_NOTES)
add("COMPLEX-048",
    "What transparency information must providers of general-purpose AI models provide under Annexes XI and XII?",
    "complex", "medium", ["Annex XI", "Annex XII"], COMPLEX_NOTES)
add("COMPLEX-049",
    "How do the safeguard procedures in Articles 81-83 protect AI system providers during market surveillance disputes?",
    "complex", "medium", ["Article 81", "Article 82", "Article 83"], COMPLEX_NOTES)
add("COMPLEX-050",
    "What are the obligations for providers and deployers regarding AI literacy (Article 4) and how do they scale with organisation size?",
    "complex", "medium", ["Article 4"], COMPLEX_NOTES)

# ======================================================================
# MULTI_HOP — multi-step reasoning across 3+ articles
# ======================================================================

MULTI_HOP_BASE = "Multi-step reasoning — requires combining information across multiple articles to answer."

add("MULTI_HOP-001",
    "A company develops a high-risk AI system for hiring. It must comply with risk management (Art 9), data governance (Art 10), and human oversight (Art 14). The deployer uses it for recruitment decisions. What obligations apply to the deployer under Article 26? If the company later modifies the system substantially (Art 3(23)), what re-assessment is triggered and what penalties could apply under Article 99?",
    "multi_hop", "low", ["Article 9", "Article 10", "Article 14", "Article 3(23)", "Article 26", "Article 99"], MULTI_HOP_BASE)
add("MULTI_HOP-002",
    "An AI startup trains a general-purpose AI model with 10^26 FLOPs. Under Article 51 it is classified as having systemic risk. What obligations apply under Articles 53 and 55? How does the startup use codes of practice under Article 56 to demonstrate compliance? What fines under Article 101 could apply for non-compliance?",
    "multi_hop", "low", ["Article 51", "Article 53", "Article 55", "Article 56", "Article 101"], MULTI_HOP_BASE)
add("MULTI_HOP-003",
    "A Member State wants to establish an AI regulatory sandbox. What must they provide under Articles 57-58? A small start-up participating in the sandbox benefits from measures under Article 62. After testing, the system is placed on the market as high-risk. What conformity assessment under Article 43 is required and what CE marking rules under Article 47 apply?",
    "multi_hop", "low", ["Article 57", "Article 58", "Article 62", "Article 43", "Article 47"], MULTI_HOP_BASE)
add("MULTI_HOP-004",
    "A deployer uses a high-risk AI system in law enforcement for real-time biometric identification. Under Article 5(h) this is prohibited unless specific exceptions apply. What transparency obligations under Article 50 must the deployer follow? If affected persons seek an explanation of decisions made using the system, what right does Article 86 provide?",
    "multi_hop", "low", ["Article 5(h)", "Article 50", "Article 86"], MULTI_HOP_BASE)
add("MULTI_HOP-005",
    "A provider places a high-risk AI system that uses emotion recognition in the workplace. Under Article 5(f) this is prohibited. What other prohibitions in Article 5 are relevant? If the system processes biometric data, what definitions in Article 3 apply? What transparency obligations under Article 50 must the deployer fulfil toward affected workers?",
    "multi_hop", "low", ["Article 5(f)", "Article 5(g)", "Article 3(9)", "Article 3(10)", "Article 50"], MULTI_HOP_BASE)
add("MULTI_HOP-006",
    "An importer brings a high-risk AI system into the EU from a third country. Under Article 23, what must the importer verify? If the importer places the system on the market under their own name, what liability under Article 25 is triggered? How does Article 22 govern the authorised representative relationship?",
    "multi_hop", "low", ["Article 23", "Article 25", "Article 22"], MULTI_HOP_BASE)
add("MULTI_HOP-007",
    "During post-market monitoring under Article 72, a provider discovers a serious incident involving their high-risk AI system. Under Article 78, what must they report and to whom? If the incident involves non-compliance, what corrective actions under Article 20 must they take? What cooperation duties under Article 21 apply?",
    "multi_hop", "low", ["Article 72", "Article 78", "Article 20", "Article 21"], MULTI_HOP_BASE)
add("MULTI_HOP-008",
    "A public authority plans to deploy a high-risk AI system for allocating essential public services. Under what conditions in Annex III is this high-risk? What fundamental rights impact assessment under Article 27 must the deployer conduct before deployment? How does Article 26 govern the deployer's general obligations?",
    "multi_hop", "low", ["Annex III", "Article 27", "Article 26"], MULTI_HOP_BASE)
add("MULTI_HOP-009",
    "An AI system used for criminal risk assessment based solely on profiling is challenged. Under Article 5(d) this is prohibited. If the system was already on the market before the AI Act applied, what transitional provisions under Article 111 apply? What obligations for providers under Article 16 must still be met?",
    "multi_hop", "low", ["Article 5(d)", "Article 111", "Article 16"], MULTI_HOP_BASE)
add("MULTI_HOP-010",
    "A provider of a general-purpose AI model without systemic risk wants to voluntarily apply codes of conduct under Article 95. How does this interact with mandatory obligations under Article 53? What technical documentation per Annex XI must they prepare? What transparency information per Annex XII must they provide to downstream providers?",
    "multi_hop", "low", ["Article 95", "Article 53", "Annex XI", "Annex XII"], MULTI_HOP_BASE)
add("MULTI_HOP-011",
    "A notified body loses its designation under Articles 34-38. What obligations does the notifying authority have under Article 34 to reallocate conformity assessment tasks? If products already certified by the former body are on the market, how do Articles 46-47 on CE marking and EU declaration of conformity ensure continued compliance?",
    "multi_hop", "low", ["Article 34", "Article 35", "Article 36", "Article 37", "Article 38", "Article 46", "Article 47"], MULTI_HOP_BASE)
add("MULTI_HOP-012",
    "A deployer uses a high-risk AI system that was substantially modified by the deployer themselves. Under Article 25, does the deployer become a provider? What new obligations under Article 16 arise? If the modified system fails, what penalty exposure under Article 99 does the deployer face and how does Article 86's right to explanation apply to affected individuals?",
    "multi_hop", "low", ["Article 25", "Article 16", "Article 99", "Article 86"], MULTI_HOP_BASE)
add("MULTI_HOP-013",
    "An AI system covered by Annex III performs narrow procedural tasks. Under Article 6(3) it may not be high-risk if it meets certain conditions. What derogation criteria apply? What risk management system under Article 9 is still recommended? What records must be kept under Article 12 for traceability?",
    "multi_hop", "low", ["Article 6(3)", "Article 9", "Article 12"], MULTI_HOP_BASE)
add("MULTI_HOP-014",
    "Under Article 59, personal data may be processed for developing certain AI systems in the public interest. What conditions must be satisfied? What testing safeguards under Article 60 apply outside sandboxes? What informed consent requirements under Article 61 must be met for real-world testing?",
    "multi_hop", "low", ["Article 59", "Article 60", "Article 61"], MULTI_HOP_BASE)
add("MULTI_HOP-015",
    "A distributor discovers that a high-risk AI system they sell does not bear the CE marking. Under Article 24, what must the distributor do? If they continue to make it available, how does Article 25 affect their liability? What corrective actions under Article 20 must the provider take once notified?",
    "multi_hop", "low", ["Article 24", "Article 25", "Article 20"], MULTI_HOP_BASE)
add("MULTI_HOP-016",
    "An AI system is placed on the market as a safety component of machinery covered by EU harmonisation legislation. Under Article 6(1), is it automatically high-risk? If so, what requirements in Articles 8-15 apply beyond the existing product safety requirements? What harmonised standards under Article 40 may be used for presumption of conformity?",
    "multi_hop", "low", ["Article 6(1)", "Article 8", "Article 9", "Article 10", "Article 11", "Article 12", "Article 13", "Article 14", "Article 15", "Article 40"], MULTI_HOP_BASE)
add("MULTI_HOP-017",
    "Following a serious incident under Article 78, the market surveillance authority opens an investigation under Article 74. What powers does the authority have under Articles 75-76? If the provider disputes the findings, what safeguard procedures under Articles 81-83 protect the provider's rights?",
    "multi_hop", "low", ["Article 78", "Article 74", "Article 75", "Article 76", "Article 81", "Article 82", "Article 83"], MULTI_HOP_BASE)
add("MULTI_HOP-018",
    "A deployer uses an AI system for deep fake content creation. Under Article 50(2), what disclosure obligations apply? If the content is used to influence elections, what prohibited practices under Article 5 might also be triggered? What penalties under Article 99 could apply for both transparency and prohibition violations?",
    "multi_hop", "low", ["Article 50(2)", "Article 5(a)", "Article 5(b)", "Article 99"], MULTI_HOP_BASE)
add("MULTI_HOP-019",
    "An EU institution deploys a high-risk AI system without proper conformity assessment. Under Article 99(4), what administrative fines apply to EU institutions? How does Article 100's penalty framework differ from Article 99's for private entities? What obligations under Article 16 for providers still bind the institution?",
    "multi_hop", "low", ["Article 99(4)", "Article 100", "Article 16"], MULTI_HOP_BASE)
add("MULTI_HOP-020",
    "A provider develops an AI system that uses untargeted scraping of facial images from the internet. Under Article 5(e), this is prohibited. If the provider also uses the system for emotion inference in the workplace (Article 5(f)), what cumulative prohibitions apply? What transparency obligations under Article 50 apply to biometric categorisation?",
    "multi_hop", "low", ["Article 5(e)", "Article 5(f)", "Article 50"], MULTI_HOP_BASE)
add("MULTI_HOP-021",
    "A company develops a high-risk AI system for credit scoring (Annex III essential services). Under Article 10, what data governance requirements apply? Under Article 14, how must human oversight be implemented? If the system produces decisions affecting individuals, what right to explanation under Article 86 applies?",
    "multi_hop", "low", ["Annex III", "Article 10", "Article 14", "Article 86"], MULTI_HOP_BASE)
add("MULTI_HOP-022",
    "A Member State designates multiple notifying authorities under Article 70. What coordination obligations under Article 66 does the European AI Board have? How do national competent authorities interact with the AI Office under Article 64? What role does the Advisory Forum under Article 67 play in ensuring consistent governance?",
    "multi_hop", "low", ["Article 70", "Article 66", "Article 64", "Article 67"], MULTI_HOP_BASE)
add("MULTI_HOP-023",
    "An AI system provider wants to rely on harmonised standards under Article 40 for presumption of conformity. If no harmonised standards exist, what common specifications under Article 41 may they use? How do Articles 42 and 43 govern conformity assessment in the absence of standards? What CE marking obligations under Article 47 still apply?",
    "multi_hop", "low", ["Article 40", "Article 41", "Article 42", "Article 43", "Article 47"], MULTI_HOP_BASE)
add("MULTI_HOP-024",
    "A deployer of a high-risk AI system for migration control (Annex III area 7) must comply with Article 26 obligations. If affected individuals face decisions with legal effects, what procedural rights apply under Article 86? If the system was trained on biased data, what data governance requirements under Article 10 were breached?",
    "multi_hop", "low", ["Annex III", "Article 26", "Article 86", "Article 10"], MULTI_HOP_BASE)
add("MULTI_HOP-025",
    "An AI system provider uses Union harmonisation legislation listed in Annex I for compliance. Under Article 6(1), how does this affect high-risk classification? If the system also falls under Annex III, what additional requirements from Articles 8-15 apply? How do Annex II's criminal offences relate to Article 5's prohibitions?",
    "multi_hop", "low", ["Annex I", "Article 6(1)", "Article 8", "Article 9", "Article 10", "Annex II", "Article 5"], MULTI_HOP_BASE)
add("MULTI_HOP-026",
    "A provider of a general-purpose AI model fails to provide technical documentation under Article 53. What enforcement actions under Articles 88-91 can the AI Office take? If the Commission imposes fines, what limits under Article 101 apply? What corrective measures under Article 93 address systemic non-compliance?",
    "multi_hop", "low", ["Article 53", "Article 88", "Article 89", "Article 90", "Article 91", "Article 101", "Article 93"], MULTI_HOP_BASE)
add("MULTI_HOP-027",
    "A small start-up develops a high-risk AI system for education (Annex III area 3). Under Article 62, what SME-specific support measures are available? If they use an AI regulatory sandbox under Article 57, what testing flexibility do they gain? After market placement, what post-market monitoring under Article 72 is required?",
    "multi_hop", "low", ["Annex III", "Article 62", "Article 57", "Article 72"], MULTI_HOP_BASE)
add("MULTI_HOP-028",
    "A market surveillance authority issues a formal objection against a harmonised standard under Article 40. How does this affect the presumption of conformity? What steps must the Commission take under Article 98 (committee procedure) to resolve the objection? What alternative conformity assessment routes under Article 43 remain available?",
    "multi_hop", "low", ["Article 40", "Article 98", "Article 43"], MULTI_HOP_BASE)
add("MULTI_HOP-029",
    "An AI system is used for administration of justice (Annex III area 8). What classification rules under Article 6 apply? What transparency requirements under Article 13 must providers meet? If decisions are automated, what right to explanation under Article 86 applies to affected persons?",
    "multi_hop", "low", ["Annex III", "Article 6", "Article 13", "Article 86"], MULTI_HOP_BASE)
add("MULTI_HOP-030",
    "A provider offers an AI system for biometric categorisation that infers political opinions. Under Article 5(g), this is prohibited. If the system was deployed before the AI Act applied, what transitional rules under Article 111 govern? If the system also involves emotion recognition, what transparency rules under Article 50(3) apply?",
    "multi_hop", "low", ["Article 5(g)", "Article 111", "Article 50(3)"], MULTI_HOP_BASE)
add("MULTI_HOP-031",
    "A provider places an AI system on the market that is not high-risk but interacts with humans. Under Article 50(1), what disclosure is required? If the system generates synthetic content, what marking obligations under Article 50(2) apply? If the deployer publishes the content for public interest, what additional disclosure under Article 50(4) is needed?",
    "multi_hop", "low", ["Article 50(1)", "Article 50(2)", "Article 50(4)"], MULTI_HOP_BASE)
add("MULTI_HOP-032",
    "After market surveillance under Article 74, a high-risk AI system is found non-compliant. What remedies under Articles 85-87 can affected persons seek? What penalties under Article 99 may be imposed on the provider? If the system involves general-purpose AI models, what enforcement procedures under Articles 88-94 apply instead?",
    "multi_hop", "low", ["Article 74", "Article 85", "Article 86", "Article 87", "Article 99", "Article 88", "Article 89"], MULTI_HOP_BASE)
add("MULTI_HOP-033",
    "A deployer of a high-risk AI system for critical infrastructure (Annex III area 2) must ensure accuracy and robustness under Article 15. What record-keeping under Article 12 supports traceability of the system's operation? If a serious incident occurs, what reporting under Article 78 is required? How does Article 72's post-market monitoring feed into ongoing compliance?",
    "multi_hop", "low", ["Annex III", "Article 15", "Article 12", "Article 78", "Article 72"], MULTI_HOP_BASE)
add("MULTI_HOP-034",
    "A provider wants to export an AI system trained in the EU for use in a third country. Under Article 2, does the AI Act apply extraterritorially? What obligations under Article 16 for providers apply regardless of deployment location? If the system uses EU personal data for training, what data governance under Article 10 must be satisfied?",
    "multi_hop", "low", ["Article 2", "Article 16", "Article 10"], MULTI_HOP_BASE)
add("MULTI_HOP-035",
    "A scientific panel of independent experts under Article 68 is asked to evaluate a high-risk AI system during market surveillance. What access rights does the panel have under Article 69? How do their findings inform enforcement under Articles 79-83? What obligations does the provider have under Article 21 to cooperate?",
    "multi_hop", "low", ["Article 68", "Article 69", "Article 79", "Article 80", "Article 21"], MULTI_HOP_BASE)
add("MULTI_HOP-036",
    "A provider notifies a serious incident under Article 78. Other Member States' authorities must be informed under Article 79. If the incident indicates a systemic issue across the Union, what safeguard procedure under Articles 81-83 is activated? How does the Commission coordinate the response?",
    "multi_hop", "low", ["Article 78", "Article 79", "Article 81", "Article 82", "Article 83"], MULTI_HOP_BASE)
add("MULTI_HOP-037",
    "An organisation develops an AI system in-house for non-professional personal use. Under Article 2, this is excluded from scope. However, if the same system is offered to third parties, what obligations under Articles 8-15 apply? How does Article 16 define 'placing on the market'?",
    "multi_hop", "low", ["Article 2", "Article 8", "Article 9", "Article 10", "Article 11", "Article 12", "Article 13", "Article 14", "Article 15", "Article 16"], MULTI_HOP_BASE)
add("MULTI_HOP-038",
    "A notified body conducts conformity assessment under Article 43 for a high-risk AI system using Annex VII (quality management system). How does Annex V's EU declaration of conformity relate to this assessment? What obligations under Article 46 govern the declaration? If the body issues a certificate, what duties under Articles 36-38 govern ongoing surveillance?",
    "multi_hop", "low", ["Article 43", "Annex VII", "Annex V", "Article 46", "Article 36", "Article 37", "Article 38"], MULTI_HOP_BASE)
add("MULTI_HOP-039",
    "A deployer in the employment context (Annex III area 4) uses a high-risk AI for recruitment. Under Article 26(10), they must inform workers. Under Article 27, the deployer must conduct a fundamental rights impact assessment. If an applicant is rejected by the system, what right to explanation under Article 86 applies?",
    "multi_hop", "low", ["Annex III", "Article 26(10)", "Article 27", "Article 86"], MULTI_HOP_BASE)
add("MULTI_HOP-040",
    "The European AI Board identifies divergent national enforcement practices. Under Article 66, what tasks empower the Board to address this? How does Article 67's Advisory Forum contribute expertise? What guidelines under Article 96 can the Commission issue to harmonise enforcement?",
    "multi_hop", "low", ["Article 66", "Article 67", "Article 96"], MULTI_HOP_BASE)
add("MULTI_HOP-041",
    "A provider of a general-purpose AI with systemic risk fails to conduct model evaluation under Article 55. The AI Office opens proceedings under Article 89. If the provider does not remedy the breach, what fines under Article 101 apply? How does Article 93 allow the Commission to impose corrective measures?",
    "multi_hop", "low", ["Article 55", "Article 89", "Article 101", "Article 93"], MULTI_HOP_BASE)
add("MULTI_HOP-042",
    "An AI system for biometric identification is deployed by law enforcement under the Article 5(h) exceptions for searching for victims. What case-by-case authorisation must be obtained? What notification obligations under Article 50 apply? If the system makes errors, what right to remedy under Article 86 applies?",
    "multi_hop", "low", ["Article 5(h)", "Article 50", "Article 86"], MULTI_HOP_BASE)
add("MULTI_HOP-043",
    "A provider's high-risk AI system relies on synthetic training data because real data cannot be collected without bias. Under Article 10(4), what conditions apply to synthetic data? What validity requirements for training data under Article 10(3) must still be met? How does risk management under Article 9 address data-related risks?",
    "multi_hop", "low", ["Article 10(4)", "Article 10(3)", "Article 9"], MULTI_HOP_BASE)
add("MULTI_HOP-044",
    "A provider wants to withdraw a non-compliant high-risk AI system from the market under Article 20. What corrective duties apply? If the system poses a risk to fundamental rights, what information duties under Article 21 apply to authorities? How do remedies available to affected persons under Articles 85-87 interact with the withdrawal?",
    "multi_hop", "low", ["Article 20", "Article 21", "Article 85", "Article 86", "Article 87"], MULTI_HOP_BASE)
add("MULTI_HOP-045",
    "A general-purpose AI model provider receives a request for documentation from a downstream provider under Article 53. What information per Annex XI must they share? If the provider refuses, what rights does the downstream entity have under Article 88? What fines under Article 101 apply to the upstream provider for non-cooperation?",
    "multi_hop", "low", ["Article 53", "Annex XI", "Article 88", "Article 101"], MULTI_HOP_BASE)
add("MULTI_HOP-046",
    "A Member State allows real-world testing of a high-risk AI system under Article 60. Before deployment, what informed consent under Article 61 must be obtained from test subjects? What data processing under Article 59 may apply? After testing, if the system is placed on the market, what registration in the EU database under Article 71 is needed?",
    "multi_hop", "low", ["Article 60", "Article 61", "Article 59", "Article 71"], MULTI_HOP_BASE)
add("MULTI_HOP-047",
    "A supplier of training data for a high-risk AI system fails to ensure data relevance and representativeness. What data governance requirements under Article 10 are violated? How does this affect the provider's obligations under Articles 16-17 for quality management? What risk management under Article 9 should have identified this data quality issue?",
    "multi_hop", "low", ["Article 10", "Article 16", "Article 17", "Article 9"], MULTI_HOP_BASE)
add("MULTI_HOP-048",
    "A provider's high-risk AI system uses a general-purpose AI model as a component. Under Article 25, how are responsibilities allocated along the AI value chain? What transparency information under Annex XII must the GP-AI provider supply? What additional obligations under Articles 8-15 apply to the high-risk system provider?",
    "multi_hop", "low", ["Article 25", "Annex XII", "Article 8", "Article 9", "Article 10", "Article 11", "Article 12", "Article 13", "Article 14", "Article 15"], MULTI_HOP_BASE)
add("MULTI_HOP-049",
    "After the AI Act applies, a Commission evaluation under Article 112 finds that enforcement is inconsistent. What amendments may the Commission propose? How does the Board's work under Article 66 inform this evaluation? What guidelines under Article 96 could address inconsistencies before legislative changes?",
    "multi_hop", "low", ["Article 112", "Article 66", "Article 96"], MULTI_HOP_BASE)
add("MULTI_HOP-050",
    "A large technology company deploys an AI system that uses subliminal techniques prohibited under Article 5(a). The deployer claims they relied on the provider's claim of compliance. Under Article 25, does liability shift to the provider? What penalties under Article 99 apply to each party? If the system involves a GP-AI model, what fines under Article 101 also apply?",
    "multi_hop", "low", ["Article 5(a)", "Article 25", "Article 99", "Article 101"], MULTI_HOP_BASE)

# ======================================================================
# Write file
# ======================================================================

OUTPUT = BASE_DIR / "eu_ai_act_queries.json"
with OUTPUT.open("w", encoding="utf-8") as f:
    json.dump(QUERIES, f, indent=2, ensure_ascii=False)

counts = {"simple": 0, "complex": 0, "multi_hop": 0}
for q in QUERIES:
    counts[q["difficulty"]] += 1
print(f"Wrote {len(QUERIES)} queries to {OUTPUT}")
print(f"  Simple:   {counts['simple']}")
print(f"  Complex:  {counts['complex']}")
print(f"  MultiHop: {counts['multi_hop']}")
