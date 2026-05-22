const express = require('express');
const path = require('path');
const fs = require('fs');
const sass = require('sass');
const sharp = require('sharp');
const app = express();
const PORT = 8080;

// Motor de randare EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get("/favicon.ico", function (req, res) {
  res.sendFile(path.join(__dirname, "resurse/ico/favicon.ico"))
});

obGlobal = {
  obErori: null,
  obImagini: null,
  folderScss: path.join(__dirname, "resurse/scss"),
  folderCss: path.join(__dirname, "resurse/css"),
  folderBackup: path.join(__dirname, "backup"),
}

let vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"]
for (let folder of vect_foldere) {
  let caleFolder = path.join(__dirname, folder);
  if (!fs.existsSync(caleFolder)) {
    fs.mkdirSync(path.join(caleFolder), { recursive: true });
  }
}

// Afișare căi
console.log('__dirname:         ', __dirname);
console.log('__filename:        ', __filename);
console.log('process.cwd():     ', process.cwd());

// Servire fișiere statice (CSS, imagini etc.) — după rute, pentru a nu le suprascrie
app.use('/resurse', express.static(path.join(__dirname, 'resurse')));

// Bootstrap
app.use("/dist", express.static(path.join(__dirname, "node_modules/bootstrap/dist")));

// Rută principală
app.get(["/", "/index", "/home"], function (req, res) {
  res.render("pagini/index", {
    ip: req.ip,
    imagini: obGlobal.obImagini.imagini,
  });
});

function verificareErori() {
  const caleFisier = path.join(__dirname, "resurse/json/erori.json");

  // Nu există fisierul erori.json
  if (!fs.existsSync(caleFisier)) {
    console.error("EROARE CRITICĂ: Nu există fișierul erori.json! Aplicația se va închide.");
    process.exit();
  }

  const continutString = fs.readFileSync(caleFisier, "utf-8");

  // Verificare proprietăți duplicate pe string (în cadrul unui obiect)
  let blocks = continutString.split('{');
  for (let i = 1; i < blocks.length; i++) {
    let objectBody = blocks[i].split('}')[0];
    let keys = [...objectBody.matchAll(/"([^"]+)"\s*:/g)].map(m => m[1]);
    let uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      console.error("EROARE: În erori.json există un obiect cu o proprietate specificată de mai multe ori (ex: titlu dublat). Verificați fișierul!");
    }
  }

  let erori;
  try {
    erori = JSON.parse(continutString);
  } catch (e) {
    console.error("EROARE: Fișierul erori.json nu are un format JSON valid.");
    return;
  }

  // Verificare proprietăți principale lipsă
  if (!erori.info_erori || !erori.cale_baza || !erori.eroare_default) {
    console.error("EROARE: Lipsesc proprietăți principale (info_erori, cale_baza sau eroare_default) din erori.json.");
  } else {
    // Verificare proprietăți eroare_default
    if (!erori.eroare_default.titlu || !erori.eroare_default.text || !erori.eroare_default.imagine) {
      console.error("EROARE: Pentru eroare_default lipsește una dintre proprietățile: titlu, text sau imagine.");
    }

    // Verificare cale_baza
    const caleFolder = path.join(__dirname, erori.cale_baza);
    if (!fs.existsSync(caleFolder)) {
      console.error(`EROARE: Folderul specificat în cale_baza ("${erori.cale_baza}") nu există în sistemul de fișiere.`);
    } else {
      // Verificare existență imagini în sistemul de fișiere
      let imaginiDeVerificat = new Set([erori.eroare_default.imagine]);
      for (let err of erori.info_erori) {
        if (err.imagine)
          imaginiDeVerificat.add(err.imagine);
      }

      for (let img of imaginiDeVerificat) {
        if (!fs.existsSync(path.join(caleFolder, img))) {
          console.error(`EROARE: Fișierul imagine ("${img}") asociat unei erori nu există în folderul "${erori.cale_baza}".`);
        }
      }
    }

    // Verificare identificatori duplicați în vectorul de erori
    let contorId = {};
    for (let err of erori.info_erori) {
      if (!contorId[err.identificator])
        contorId[err.identificator] = [];
      contorId[err.identificator].push(err);
    }

    for (let id in contorId) {
      if (contorId[id].length > 1) {
        console.error(`EROARE: Există mai multe erori cu același identificator (${id}). Detalii erori:`);
        for (let err of contorId[id]) {
          let copie = { ...err };
          delete copie.identificator;
          console.error(JSON.stringify(copie));
        }
      }
    }
  }
}
verificareErori();

/**
 * Inițializează obiectul global de erori (obGlobal.obErori) prin citirea 
 * și parsarea fișierului erori.json, completând calea absolută a imaginilor.
 */
function initErori() {
  let continut = fs.readFileSync(path.join(__dirname, "resurse/json/erori.json")).toString("utf-8");
  let erori = obGlobal.obErori = JSON.parse(continut)
  let err_default = erori.eroare_default
  err_default.imagine = path.join(erori.cale_baza, err_default.imagine)
  for (let eroare of erori.info_erori) {
    eroare.imagine = path.join(erori.cale_baza, eroare.imagine)
  }
}
initErori()

/**
 * Randează pagina de eroare personalizată în funcție de identificator (status code).
 * Dacă parametrii specifici lipsesc, se folosesc valorile implicite din erori.json.
 */
function afisareEroare(res, identificator, titlu, text, imagine) {
  //TO DO cautam eroarea dupa identificator
  let eroare = obGlobal.obErori.info_erori.find((elem) =>
    elem.identificator == identificator
  )
  //daca sunt setate titlu, text, imagine, le folosim, 
  //altfel folosim cele din fisierul json pentru eroarea gasita
  //daca nu o gasim, afisam eroarea default
  let errDefault = obGlobal.obErori.eroare_default;
  if (eroare?.status)
    res.status(eroare.identificator)
  res.render("pagini/eroare", {
    imagine: imagine || eroare?.imagine || errDefault.imagine,
    titlu: titlu || eroare?.titlu || errDefault.titlu,
    text: text || eroare?.text || errDefault.text,
  });
}

app.get("/eroare", function (req, res) {
  res.render("pagini/eroare", {
    imagine: obGlobal.obErori.eroare_default.imagine,
    titlu: obGlobal.obErori.eroare_default.titlu,
    text: obGlobal.obErori.eroare_default.text,
  });
});

/**
 * Inițializează galeria de imagini din galerie.json și procesează imaginile.
 * Creează versiuni optimizate în format WebP (redimensionate la 300px lățime) 
 * în directorul "mediu" utilizând biblioteca Sharp și setează căile virtuale.
 */
function initImagini() {
  var continut = fs.readFileSync(path.join(__dirname, "resurse/json/galerie.json")).toString("utf-8");

  obGlobal.obImagini = JSON.parse(continut);
  let vImagini = obGlobal.obImagini.imagini;
  let caleGalerie = obGlobal.obImagini.cale_galerie

  let caleAbs = path.join(__dirname, caleGalerie);
  let caleAbsMediu = path.join(caleAbs, "mediu");
  if (!fs.existsSync(caleAbsMediu))
    fs.mkdirSync(caleAbsMediu);

  for (let imag of vImagini) {
    [numeFis, ext] = imag.cale_fisier.split("."); //"ceva.png" -> ["ceva", "png"]
    let caleFisAbs = path.join(caleAbs, imag.cale_fisier);
    let caleFisMediuAbs = path.join(caleAbsMediu, numeFis + ".webp");
    sharp(caleFisAbs).resize(300).toFile(caleFisMediuAbs);
    imag.fisier_mediu = path.join("/", caleGalerie, "mediu", numeFis + ".webp")
    imag.cale_fisier = path.join("/", caleGalerie, imag.cale_fisier)
  }
}
initImagini();

/**
 * Compilează un fișier SCSS într-un fișier CSS.
 * Înainte de compilare, realizează o copie de siguranță (backup) a fișierului CSS 
 * existent. Generează fișierul CSS compilat împreună cu sourcemap-ul aferent.
 */
function compileazaScss(caleScss, caleCss) {
  if (!caleCss) {

    let numeFisExt = path.basename(caleScss); // "folder1/folder2/a.scss" -> "a.scss"
    let numeFis = numeFisExt.split(".")[0]   /// "a.scss"  -> ["a","scss"]
    caleCss = numeFis + ".css"; // output: a.css
  }

  if (!path.isAbsolute(caleScss))
    caleScss = path.join(obGlobal.folderScss, caleScss)
  if (!path.isAbsolute(caleCss))
    caleCss = path.join(obGlobal.folderCss, caleCss)

  let caleBackup = path.join(obGlobal.folderBackup, "resurse/css");
  if (!fs.existsSync(caleBackup)) {
    fs.mkdirSync(caleBackup, { recursive: true })
  }

  // la acest punct avem cai absolute in caleScss si  caleCss

  let numeFisCss = path.basename(caleCss);
  if (fs.existsSync(caleCss)) {
    fs.copyFileSync(caleCss, path.join(obGlobal.folderBackup, "resurse/css", numeFisCss))// +(new Date()).getTime()
  }
  rez = sass.compile(caleScss, { "sourceMap": true });
  fs.writeFileSync(caleCss, rez.css)

}

vFisiere = fs.readdirSync(obGlobal.folderScss);
for (let numeFis of vFisiere) {
  if (path.extname(numeFis) == ".scss") {
    compileazaScss(numeFis);
  }
}

fs.watch(obGlobal.folderScss, function (eveniment, numeFis) {
  if (eveniment == "change" || eveniment == "rename") {
    let caleCompleta = path.join(obGlobal.folderScss, numeFis);
    if (fs.existsSync(caleCompleta)) {
      compileazaScss(caleCompleta);
    }
  }
})

app.get("/chitare", function (req, res) {
  res.render("pagini/chitare", {
    imagini: obGlobal.obImagini.imagini,
  });
});

app.get("/*pagina", function (req, res) {
  console.log("Cale pagina", req.url);
  //verificam daca este un folder din /resurse
  if (req.url.startsWith("/resurse") && path.extname(req.url) == "") {
    afisareEroare(res, 403);
    return;
  }
  //eroare 400 la fisierele .ejs (templateuri-le )
  if (path.extname(req.url) == ".ejs") {
    afisareEroare(res, 400);
    return;
  }
  try {
    res.render("pagini" + req.url, function (err, rezRandare) {
      if (err) {
        if (err.message.includes("Failed to lookup view")) {
          afisareEroare(res, 404)
        }
        else {
          afisareEroare(res);
        }
      }
      else {
        res.send(rezRandare);
      }
    });
  }
  catch (err) {
    if (err.message.includes("Cannot find module")) {
      afisareEroare(res, 404)
    }
    else {
      afisareEroare(res);
    }
  }
});

// Pornire server
app.listen(PORT, () => {
  console.log(`Serverul rulează la http://localhost:${PORT}`);
});