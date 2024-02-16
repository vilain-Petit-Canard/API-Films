const express = require("express");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const mustacheExpress = require("mustache-express");
const db = require("./config/db.js");
const { check, validationResult } = require("express-validator");

//Configurations
dotenv.config();

const server = express();
////////////////

server.set("views", path.join(__dirname, "views"));
server.set("view engine", "mustache");
server.engine("mustache", mustacheExpress());

//Middlewares
//Doit être avant les routes/points d'accès
server.use(express.static(path.join(__dirname, "public")));

//Permet d'accepter des body en Json dans les requêtes
server.use(express.json());



// Points d'accès aux films avec les des parametres de tri, d'ordre et de limit ////////////////////////////////////////////////////////////
server.get("/api/films", async (req, res) => {
    try {
        const tri = req.query.tri || "titre";
        const ordre = req.query.ordre || "asc";
        const limit = +req.query.limite || 3; //Mettre une valeur par défaut

        // const donneesRef = await db.collection("films").orderBy("user", direction).limit(limit).get();
        const donneesRef = await db.collection("films").orderBy(tri, ordre).limit(limit).get();
        // console.log(donneesRef);
        const donneesFinale = [];

        donneesRef.forEach((doc) => {
            donneesFinale.push(doc.data());
        });

        res.statusCode = 200;
        res.json(donneesFinale);
    } catch (erreur) {
        res.statusCode = 500;
        res.json({ message: "Une erreur est survenue dans la requete" });
    }
});


/**
 * @method GET
 * @param id
 * @see url à consulter
 * Permet d'accéder à un film
 */
server.get("/api/films/:id", async (req, res) => {
    const id = req.params.id;
    const film = await db.collection("films").doc(id).get();
    const filmData = film.data();
    // Verification si le id du film est mauvais
    if (!(filmData == null)) {
        res.statusCode = 200;
        res.json(filmData);
    } else {
        res.statusCode = 404;
        res.json({ message: "film non trouvé" })
    }
});

/**
 * Function pour ajouter un film a la bd
 * @method post
 * Pour tester des donnees formulaire sans une page htmp avec formulaire dans postman, 
 * il faut choisir raw, choisir le type de fichier en json et envoyer du contenu json 
 */
server.post("/api/films", async (req, res) => {
    try {
        const nouveauFilm = req.body;
        console.log(nouveauFilm);
        const fimlAjouter = await db.collection("films").add(nouveauFilm);
        res.statusCode = 200;
        res.json({ message: `Le document avec l'id ${fimlAjouter.id} a été ajouté` });
    } catch (err) {
        res.status(500).send(err);
    }
})

// function pour mettre les donnes test de film dans la base de donnees firebase
server.post("/donnees/initialiser", (req, res) => {
    const donneesTest = require("./data/filmsTest.js");

    donneesTest.forEach(async (element) => {
        await db.collection("films").add(element);
    });

    res.statusCode = 200;

    res.json({
        message: "Données initialisées",
    });
});


/**
 * Fonction pour modifier un film en se servant de son id
 * @method put
 * @param id
 */
server.put("/api/films/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const film = req.body;
        await db.collection("films").doc(id).update(film);
        res.json({ message: `Le film avec l'id ${id} a été modifié` });
        res.statusCode = 200;
    } catch (err) {
        // res.status(500).send(err);
        res.statusCode = 500;
        res.json({ message: "film non trouvé" })
    }
});

/**
 * Fonction pour supprimer un film de la base de données avec son id
 * @method delete
 * @param id
 */
server.delete("/api/films/:id", async (req, res) => {
    try {
        const id = req.params.id;
        await db.collection("films").doc(id).delete();
        res.json({ message: `Le film avec l'id ${id} a été supprimé` });
        res.statusCode = 200;
    } catch (err) {
        res.statusCode = 500;
        res.json({ message: "film non trouvé" })
    }
});


/**
 * Fonction pour incrire un utilsateur et l'ajouter a la bd
 * @method post
 */

server.post(
    "/utilisateurs/inscription",
    [
        check("courriel").escape().trim().notEmpty().isEmail().normalizeEmail(),
        check("mdp").escape().trim().notEmpty().isLength({ min: 8, max: 20 }).isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minNumbers: 1,
            minUppercase: 1,
            minSymbols: 1,
        }),
    ],
    async (req, res) => {
        const validation = validationResult(req);
        if (validation.errors.length > 0) {
            res.statusCode = 400;
            return res.json({ message: "Données non-conformes" });
        }
        const { courriel, mdp } = req.body;
        // On vérifie si le courriel existe
        const docRef = await db.collection("utilisateurs").where("courriel", "==", courriel).get();
        const utilisateurs = [];

        docRef.forEach((doc) => {
            utilisateurs.push(doc.data());
        });

        console.log(utilisateurs);
        // Si oui, erreur
        if (utilisateurs.length > 0) {
            res.statusCode = 400;
            return res.json({ message: "Le courriel existe déjà" });
        }

        // On valide/nettoie la donnée
        // TODO:
        // On encrypte le mot de passe

        // const hash = await bcrypt.hash(mdp, 10);

        // On enregistre dans la DB
        // const nouvelUtilisateur = { courriel, mdp: hash };
        const nouvelUtilisateur = { courriel, mdp };
        await db.collection("utilisateurs").add(nouvelUtilisateur);

        delete nouvelUtilisateur.mdp;
        // On renvoie true;
        res.statusCode = 200;
        res.json(nouvelUtilisateur);
    }
);

/**
 * Fonction pour se connecter en tant qu'utilisateur deja inscrit
 * 
 */
server.post("/utilisateurs/connexion", async (req, res) => {
    // On récupère les infos du body
    const { mdp, courriel } = req.body;

    // On vérifie si le courriel existe
    const docRef = await db.collection("utilisateurs").where("courriel", "==", courriel).get();

    const utilisateurs = [];
    docRef.forEach((utilisateur) => {
        utilisateurs.push(utilisateur.data());
    });
    // Si non, erreur
    if (utilisateurs.length == 0) {
        res.statusCode = 400;
        return res.json({ message: "Courriel invalide" });
    }

    const utilisateurAValider = utilisateurs[0];
    const estValide = mdp === utilisateurAValider.mdp;
    // const estValide = await bcrypt.compare(mdp, utilisateurAValider.mdp);
    // console.log(utilisateurAValider);
    // On compare
    // Si pas pareil, erreur
    if (!estValide) {
        res.statusCode = 400;
        return res.json({ message: "Mot de passe invalide" });
    }

    // On retourne les infos de l'utilisateur sans le mot de passe
    delete utilisateurAValider.mdp;
    res.status = 200;
    res.json(utilisateurAValider);
});
// // DOIT Être la dernière!!
// Gestion page 404 - requête non trouvée

server.use((req, res) => {
    res.statusCode = 404;
    res.render("404", { url: req.url });
});

server.listen(process.env.PORT, () => {
    console.log("Le serveur a démarré");
});
