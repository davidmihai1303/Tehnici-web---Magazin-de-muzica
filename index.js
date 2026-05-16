const express = require('express');
const path = require('path');
const fs = require('fs');
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

// Rută principală
app.get(["/", "/index", "/home"], function (req, res) {
  res.render("pagini/index", {
    ip: req.ip
  });
});

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
