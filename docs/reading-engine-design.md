# Palmora AI — Reading Engine & Interpretation Architecture

**Version:** 2.1.0  
**Status:** Validated  
**Component:** Deterministic Archetype Library & LLM Guardrail Layer  

---

## 1. Architectural Philosophy: The Deterministic Bridge

Palmora AI decouples physical observation from cultural interpretation:
1. **Computer Vision Layer:** Produces strictly objective, verifiable geometric measurements (arc length in mm, curvature ratio, continuity score, orientation angle, branching count).
2. **Deterministic Selection Layer:** Uses a pure, versioned decision tree to select curated palmistry archetypes based on exact numerical thresholds.
3. **AI Narrative Layer (LLM):** Translates selected archetypes into warm, thoughtful, self-reflective prose. The LLM is **strictly forbidden** from inventing visual features or performing independent visual analysis.
4. **Epistemological Boundary:** Traditional chirological lore is explicitly presented as cultural, symbolic introspection—never as scientific or predictive truth.

```mermaid
graph LR
    A[Detected Crease Geometry] --> B[Deterministic Decision Tree]
    B --> C[Versioned Interpretation Library v2.1]
    C --> D[Strict Structural Prompt Payload]
    D --> E[LLM Narrative Synthesis]
    E --> F[Client Report with Epistemic Disclaimer]
```

---

## 2. Versioned Interpretation Library (`v2.1.0`)

The interpretation library defines stable, auditable records for every anatomical crease permutation across historical traditions (Western Classical Chiromancy, 19th-Century Benham Morphology, and Indian Samudrika Shastra).

### 2.1 Heart Line Archetypes (`archetype_heart_*`)

#### `archetype_heart_curved_expressive_v2`
- **Stable Identifier:** `HL-CURV-01`
- **Feature Trigger:** Curvature $\ge 1.22$, Length $\ge 55\text{mm}$, Orientation $> 15^\circ$.
- **Historical Tradition:** Classical Western Chiromancy (Cheiro, *Language of the Hand*, 1897); Benham (*The Laws of Scientific Hand Reading*, 1900).
- **Symbolic Interpretation:**
  - Trajectory curving gracefully toward the Mount of Jupiter (beneath the index finger).
  - Symbolizes open emotional expression, relational warmth, empathy, and high social investment.
  - Tends to prioritize relational harmony and heartfelt communication.
- **Reflective Inquiry:** "In what areas of your life do your natural empathy and openness serve you best, and where do they require clearer boundaries?"
- **Limitations & Epistemic Uncertainty:**
  - Crease depth and length fluctuate with hand hydration, muscular development, and occupational use.
  - This observation reflects symbolic typology, not psychological diagnostics.

#### `archetype_heart_straight_analytical_v2`
- **Stable Identifier:** `HL-STRT-02`
- **Feature Trigger:** Curvature $< 1.15$, Length $\ge 45\text{mm}$.
- **Historical Tradition:** 19th-Century French & British Chirology (d'Arpentigny, 1856; Benham, 1900).
- **Symbolic Interpretation:**
  - Direct, transverse course terminating between the Mounts of Saturn and Jupiter.
  - Symbolizes emotional composure, pragmatic communication, and deliberate processing of feelings.
  - Prone to analyzing emotional situations through reason before expressing vulnerability.
- **Reflective Inquiry:** "When navigating intense emotional moments, how do you balance rational analysis with intuitive vulnerability?"
- **Limitations & Epistemic Uncertainty:**
  - Transverse lines can appear flatter when the hand is held in excessive tension during photo capture.

#### `archetype_heart_branched_creative_v2`
- **Stable Identifier:** `HL-BRCH-03`
- **Feature Trigger:** Branching Count $\ge 2$, Confidence $\ge 0.50$.
- **Historical Tradition:** Indian Samudrika Shastra (Trident / Forked Termination lore).
- **Symbolic Interpretation:**
  - Forked termination radiating toward multiple finger mounts.
  - Symbolizes emotional versatility, diplomacy, and the capacity to perceive multiple sides of an emotional debate.
- **Reflective Inquiry:** "How do your varied interests and nuanced perspective influence your personal relationships?"
- **Limitations & Epistemic Uncertainty:**
  - Superficial skin folds near the index finger can mimic branching; verified by continuity score.

---

### 2.2 Head Line Archetypes (`archetype_head_*`)

#### `archetype_head_sloped_intuitive_v2`
- **Stable Identifier:** `HD-SLOP-01`
- **Feature Trigger:** Curvature $\ge 1.18$, Orientation $< -12^\circ$.
- **Historical Tradition:** Western Classical Chiromancy (Desbarrolles, 1869; Cheiro, 1897).
- **Symbolic Interpretation:**
  - Line descending gently toward the Mount of the Moon (lower hypothenar eminence).
  - Symbolizes associative reasoning, creative intuition, metaphorical thinking, and an appreciation for narrative context over pure statistics.
- **Reflective Inquiry:** "When solving complex challenges, how do you nurture both your creative instincts and rigorous pragmatic details?"
- **Limitations & Epistemic Uncertainty:**
  - Downward slope can be exaggerated if the hand is tilted toward the wrist during camera capture.

#### `archetype_head_linear_pragmatic_v2`
- **Stable Identifier:** `HD-LINR-02`
- **Feature Trigger:** Curvature $< 1.12$, Length $\ge 50\text{mm}$.
- **Historical Tradition:** Benham (*The Laws of Scientific Hand Reading*, 1900).
- **Symbolic Interpretation:**
  - Straight, horizontal path traversing across the plain of Mars toward the percussion.
  - Symbolizes linear problem-solving, structured cognitive processing, clarity of focus, and empirical evaluation.
- **Reflective Inquiry:** "Where in your personal or professional life does your structured focus provide the greatest leverage?"
- **Limitations & Epistemic Uncertainty:**
  - Does not measure IQ, cognitive capability, or academic attainment.

---

### 2.3 Life Line Archetypes (`archetype_life_*`)

#### `archetype_life_wide_robust_v2`
- **Stable Identifier:** `LF-WIDE-01`
- **Feature Trigger:** Arc Length $\ge 65\text{mm}$, Curvature $\ge 1.25$.
- **Historical Tradition:** Samudrika Shastra (Pitri Rekha) & Western Chiromancy.
- **Symbolic Interpretation:**
  - Generous, wide arc encompassing the thenar eminence (Mount of Venus).
  - Traditionally associated with enthusiasm for physical vitality, dynamic engagement with life's environments, and foundational resilience.
- **Reflective Inquiry:** "What daily habits and passions best replenish your energy and sense of vitality?"
- **Limitations & Epistemic Uncertainty:**
  - **CRITICAL DISCLAIMER:** In modern ethical chirology, the life line **NEVER indicates lifespan, mortality, or health conditions**. It is purely a mechanical flexure line reflecting thumb opposition.

#### `archetype_life_close_deliberate_v2`
- **Stable Identifier:** `LF-CLOS-02`
- **Feature Trigger:** Curvature $< 1.18$, Arc Length $< 55\text{mm}$.
- **Historical Tradition:** Classical Western Chiromancy.
- **Symbolic Interpretation:**
  - Tighter arc staying closer to the thumb base.
  - Symbolizes conserved energy, intentional lifestyle curation, selective investment of time, and appreciation for domestic equilibrium.
- **Reflective Inquiry:** "How do you protect your peace and prioritize what truly matters to you?"
- **Limitations & Epistemic Uncertainty:**
  - The apparent width of the life line depends heavily on how wide the thumb was splayed during photography.

---

## 3. Strict Non-Fabrication Rule & Suppression Engine

In the event that an anatomical line is obscured, faint, or unverified:
1. **Suppression Trigger:** If `detected == False` or `clarity_confidence < 0.40`.
2. **Behavior:** The reading engine strictly outputs:
   ```json
   {
     "line_id": "life_line",
     "detected": false,
     "archetype_id": "NOT_DETECTED",
     "narrative": "The life line is not sufficiently distinct in this photograph. No interpretation generated. Try capturing again with soft, diffuse lighting and a flat palm."
   }
   ```
3. **LLM Constraint:** The LLM prompt template does not receive the key for that line, making it architecturally impossible for the AI to hallucinate observations about lines it has not been given.

---

## 4. Separation of Belief and Science

Palmora AI implements strict epistemological guardrails across all client interfaces:
- **Biometric Fact:** Palm creases are biological flexion creases that develop in the human fetus around the 12th week of gestation to allow skin to fold without buckling during grasping.
- **Cultural Fact:** Palmistry is a centuries-old cultural tradition of symbolic reflection and psychological metaphor.
- **Product Guarantee:** Palmora AI provides an engaging, reflective, personalized journey rooted in real image geometry, while maintaining complete scientific honesty regarding the symbolic nature of its interpretations.

---
*End of Reading Engine Design.*
