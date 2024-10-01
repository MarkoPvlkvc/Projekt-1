const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

app.get("/generate-ticket", (req, res) => {
  const { vatin, firstName, lastName } = req.body;

  // za jedan OIB / vatin se smije generirati do uključivo 3 ulaznice

  // identifikator ulaznice nije normalan broj, nego npr. UUID iz PostgreSQLa

  // rezultat uspješnog poziva je QR kod koji sadrži url na stranici s UUID / identifikatorom ulaznice
  // u urlu smije biti samo identifikator ulaznice

  // u slučaju pogreške vratiti 400 ili 500 s opisom greške
  // status 400 se treba vratiti ako ulazni JSON ne sadrži sve tražene podatke ili su za navedeni OIB već kupljene 3 ulaznice

  // pristupna točka mora koristiti autorizacijski mehanizam OAuth2 Client Credentials (machine-to-machine)
  // nije vezan za konkretnog korisnika, već za pojedinu aplikaciju.
  // (https://auth0.com/blog/using-m2m-authorization)
  // (https://www.rfc-editor.org/rfc/rfc6749#section-1.3.1)

  // url koji sadrži identifikator ulaznice prikazuje podatke ulaznice (vatin/OIB, ime, prezime i vrijeme nastanka ulaznice)
  // pristup toj stranici imaju samo prijavljeni korisnici
  // na stranici ispisati ime trenutno prijavljenog korisnika koristeći OpenId Connect protokol

  /*
    Upravljanje korisnicima odvija se korištenjem protokola OAuth2 i OpenId Connect (OIDC) i servisa Auth0.
    Korisnike na servisu Auth0 možete dodati kroz opciju User management/Users na Auth0.
    Za pohranu podataka koristiti PostgreSQL na Renderu ili neku drugu bazu podataka po izboru (npr. Firebase).
  */
});
