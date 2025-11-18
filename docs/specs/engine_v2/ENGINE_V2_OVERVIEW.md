# ENGINE V2 — Overview

Questo documento descrive la struttura completa dell'ENGINE V2, basato su 4 assi semantici, curve quadratiche, **dispersione deterministica dei punti origine** (patch02), **mirroring finale della geometria** (patch01) e assenza totale di cluster.

## 1. Assi Semantici

### Alfa — Azione ↔ Osservazione  
Range: −100 → +100  
Usato per: Posizione orizzontale (x)

### Beta — Specifico ↔ Ampio  
Range: −100 → +100  
Usato per: Posizione verticale (y)

### Gamma — Unico ↔ Composto  
Range: −100 → +100  
Usato per:  
- Numero di linee  
- Direzione principale  
- Lunghezza delle linee

### Delta — Regolare ↔ Irregolare  
Range: −100 → +100  
Usato per:  
- Irregolarità deterministica (jitter)  
- Curvatura delle linee  
- Micro-variazioni su control point e lunghezza

## 2. Pipeline sintetica

1. Partenza da keyword.  
2. Conversione deterministica tramite dizionario/LLM → valori Alfa/Beta/Gamma/Delta.  
3. **Posizione primaria** da Alfa/Beta (coordinate normalizzate → coordinate canvas).  
4. **Dispersione punti origine** (patch02): ogni linea ottiene un punto di origine unico, disperso deterministicamente attorno al punto base (2% della diagonale del canvas, range consigliato 1–4%).  
5. **Generazione linee base** da Gamma + definizione della curvatura/irregolarità da Delta.  
6. **Mirroring finale sulla geometria**: applicato sull'array di connections dopo Gamma/Delta, come post-processing deterministico (patch01_SPEC_03_mirroring_revision).  
7. **Output finale**: elenco di curve quadratiche con arrowhead fisse.  
8. Consegna a preview/export senza modificare pipeline attuale (React/SVG, animazione, export restano invariati).
