
/**
 * Required External Modules
 */

const express = require("express");
const path = require("path");

const expressSession = require("express-session");
const passport = require("passport");
const Auth0Strategy = require("passport-auth0");

require("dotenv").config();

const authRouter = require("./auth");
const bodyParser = require('body-parser');
const cors = require("cors");
const db = require("./models");

/**
 * App Variables
 */

const app = express();
const port = process.env.PORT || "8000";

/**
 * Session Configuration
 */

const session = {
    secret: process.env.SESSION_SECRET,
    cookie: {},
    resave: false,
    saveUninitialized: false
};

if (app.get("env") === "production") {
    // Serve secure cookies, requires HTTPS
    session.cookie.secure = true;
    db.sequelize.sync({ force: true }).then(() => {
        console.log("Drop and re-sync db.");
    });
}

// index.js

/**
 * Passport Configuration
 */

/**
 * Passport Configuration
 */

const strategy = new Auth0Strategy(
    {
        domain: process.env.AUTH0_DOMAIN,
        clientID: process.env.AUTH0_CLIENT_ID,
        clientSecret: process.env.AUTH0_CLIENT_SECRET,
        callbackURL: process.env.AUTH0_CALLBACK_URL
    },
    function(accessToken, refreshToken, extraParams, profile, done) {
        /**
         * Access tokens are used to authorize users to an API
         * (resource server)
         * accessToken is the token to call the Auth0 API
         * or a secured third-party API
         * extraParams.id_token has the JSON Web Token
         * profile has all the information from the user
         */
        return done(null, profile);
    }
);

/**
 *  App Configuration
 */
var corsOptions = {
    origin: "http://localhost:8081"
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.engine('pug', require('pug').__express)
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.use(express.static(path.join(__dirname, "public")));

app.use(expressSession(session));

passport.use(strategy);
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Creating custom middleware with Express
app.use((req, res, next) => {
    res.locals.isAuthenticated = req.isAuthenticated();
    // console.log(req.isAuthenticated());
    if (req.user) {
        if(typeof(res._headers.authorization) === "undefined") {
            const accessToken = jwt.sign(req.user._json, accessTokenSecret, {expiresIn: '20m'});
            res.setHeader('Authorization', 'Bearer ' + accessToken);
        }
    }else if (!req.user){
        try {
            res.setHeader('Authorization', ' ');
        }catch{}
    }
    next();
});

const authenticateJWT = (req, res, next) => {
    console.log("authenticating");
    if (req.user) {
        const authHeader = res._headers.authorization;
        console.log(authHeader);
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            jwt.verify(token, accessTokenSecret, (err, user) => {
                if (err) {
                    return res.sendStatus(403);
                }
                req.user = user;
                next();
            });
        } else {
            res.sendStatus(401);
        }
    } else {
        console.log("Failed to validate token!");
        req.session.returnTo = req.originalUrl;
        res.redirect("/login");
    }
};

// Router mounting
app.use("/", authRouter);

/**
 * Routes Definitions
 */

const secured = (req, res, next) => {
    if (req.user) {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect("/login");
};

app.get("/", (req, res) => {
    res.render("index", { title: "Home" });
});

app.get("/user", authenticateJWT, (req, res, next) => {
    const { _raw, _json, ...userProfile } = req.user;
    res.render("user", {
        title: "Profile",
        userProfile: userProfile
    });
});

db.sequelize.sync();

/**
 * Server Activation
 */
require("./routes/tutorial.routes")(app);

app.listen(port, () => {
    console.log(`Listening to requests on http://localhost:${port}`);
});