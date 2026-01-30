// Game State
const gameState = {
    currentRound: 0,
    timeRemaining: 0,
    faulis: 0,
    timer: null,
    towers: {
        mobility: [],
        heat: [],
        electricity: []
    },
    costTower: [],
    playedCards: {},
    playerHand: [],
    goals: {
        mobility: 0,
        total: 0,
        co2: 0
    },
    uberschuss: {}, // Stores surplus solar/wind energy on cards
    h2Uberschuss: 0, // Stores H₂ (hydrogen) surplus from Wasserstofferzeugung
    fieldOccupancy: {}, // Tracks cards in each field: { fieldName: [cardId1, cardId2, ...] }
    everPlayedCards: new Set(), // Tracks card IDs that have been played at least once
    unmetUberschuss: {}, // Tracks unmet Überschuss needs per card: { cardId: { tower, needed, targetType, ratio } }
    uberschussUsage: {}, // Tracks cards currently using Überschuss: { cardId: { uberschussUsed, tower, targetType, ratio } }
    cardPlayHistory: {}, // Tracks exact changes made when each card was played for precise reversal
    stoneIdCounter: 0, // Unique ID counter for stones
    lastCO2: 0, // Track previous CO2 for impact display
    lastAction: null // Track last action for impact display: { type: 'play'|'unplay', cardName, co2Before, co2After }
};

// Energy Stone Types with CO2 values (tons per stone)
const STONE_TYPES = {
    DIESEL: { name: 'Diesel/Benzin', co2: 5, color: 'diesel', width: 6 },
    GAS: { name: 'Erdgas', co2: 4, color: 'gas', width: 4 },
    GRID_POWER: { name: 'Zugekaufter Strom', co2: 8, color: 'grid-power', width: 8 },
    CLEANER_GRID: { name: 'Saubererer Netzstrom', co2: 4, color: 'grid-power', width: 4 }, // After coal phase-out
    CLEANEST_GRID: { name: 'Sehr sauberer Netzstrom', co2: 2, color: 'grid-power', width: 2 }, // After 75% renewables
    SOLAR: { name: 'Solar', co2: 0, color: 'solar', width: 1 },
    WIND: { name: 'Wind', co2: 0, color: 'wind', width: 1 },
    HYDROGEN: { name: 'Wasserstoff (H₂)', co2: 0, color: 'hydrogen', width: 1 }
};

// Goal Cards for each round
const GOAL_CARDS = {
    1: { year: 2030, mobility: 50, total: 90, co2: 300 },
    2: { year: 2035, mobility: 40, total: 75, co2: 200 },
    3: { year: 2040, mobility: 30, total: 60, co2: 100 }
};

// Field Limits - defines how many cards can be placed in each field
const FIELD_LIMITS = {
    // Required fields with mandatory cards
    stromnetz: { max: 1, required: true, description: 'Stromnetz' },

    // Heizungsraum has two mandatory card types
    heizung: {
        max: 2,
        required: true,
        description: 'Heizungsraum',
        heatingLimit: 1,  // 1 heating card (Heizung, Wärmepumpe, etc.) - replaceable
        meterLimit: 1     // 1 meter card (Stromzähler, Smart Meter, etc.) - replaceable
    },

    // Garage handling - we'll track card types
    garage: {
        max: 5, // 5 cars max
        required: true,
        description: 'Garage',
        carLimit: 5  // 1 starter car + 4 additional
    },
    fahrrad: {
        max: 2, // 2 bikes max
        required: true,
        description: 'Fahrrad',
        bikeLimit: 2  // 1 starter bike + 1 additional
    },
    stromzaehler: { max: 1, required: true, description: 'Stromzähler' },

    // Optional fields with limits
    dach: { max: 2, required: false, description: 'Dach' },
    technikinsel: { max: 5, required: false, description: 'Technikinsel' },
    balkon: { max: 1, required: false, description: 'Balkon' },
    nachbarschaft: { max: 5, required: false, description: 'Nachbarschaftsgarage' },

    // Unlimited fields
    komfort: { max: Infinity, required: false, description: 'Komfort' },
    haustechnik: { max: Infinity, required: false, description: 'Haustechnik' }
};

// Starter Cards - Data from PDF Spielkarten Vorderseiten
const STARTER_CARDS = [
    {
        id: 'stromnetz',
        name: 'Stromnetz',
        image: 'VorderseitenEinzeln/Stromnetz.png',
        field: 'stromnetz',
        sector: 'electricity',
        description: 'Der deutsche Strommix besteht aus ca. 50 % fossilen und 50 % erneuerbaren Energieträgern.',
        effects: {
            add: [{ tower: 'electricity', type: 'GRID_POWER', count: 22 }],
            cost: 1100
        },
        unlocks: []
    },
    {
        id: 'gasheizung',
        name: 'Gasheizung',
        image: 'VorderseitenEinzeln/Gasheizung.png',
        field: 'heizung',
        sector: 'heat',
        description: 'In einer Gasheizung wird Erdgas verbrannt, um Wasser für Heizung und Dusche zu erhitzen.',
        effects: {
            add: [{ tower: 'heat', type: 'GAS', count: 32 }],  // Corrected from 27 to 32 per PDF
            cost: 750
        },
        unlocks: ['solarthermie']
    },
    {
        id: 'auto',
        name: 'Auto',
        image: 'VorderseitenEinzeln/Auto.png',
        field: 'garage',
        sector: 'mobility',
        description: 'Ein durchschnittlicher Haushalt in Deutschland besitzt ein Auto, welches Benzin oder Diesel tankt.',
        effects: {
            add: [{ tower: 'mobility', type: 'DIESEL', count: 61 }],
            cost: 3100
        },
        unlocks: []
    },
    {
        id: 'fahrrad',
        name: 'Fahrrad',
        image: 'VorderseitenEinzeln/Fahrrad.png',
        field: 'fahrrad',
        sector: 'mobility',
        description: 'Radfahren ist nicht nur gesund, sondern auch umweltfreundlich.',
        effects: {
            add: [],
            cost: 50  // Corrected from 0 to 50 per PDF
        },
        unlocks: []
    },
    {
        id: 'stromzaehler',
        name: 'Konventioneller Stromzähler',
        image: 'VorderseitenEinzeln/Konventioneller_Stromzaehler.png',
        field: 'stromzaehler',  // PDF shows "Heizungsraum"
        sector: 'electricity',
        description: 'Der analoge Konventionelle Stromzähler erfasst die Menge des im Haushalt verbrauchten Stroms.',
        effects: {
            add: [],
            cost: 0
        },
        unlocks: ['smart-meter']
    },
    {
        id: 'solarthermie',
        name: 'Solarthermie',
        image: 'VorderseitenEinzeln/Solarthermie.png',
        field: 'dach',
        sector: 'heat',
        requires: ['gasheizung'],
        description: 'Die Solarthermieanlage wandelt Sonnenenergie in Wärmeenergie um.',
        effects: {
            replace: [{ tower: 'heat', from: 'ANY', to: 'SOLAR', count: 5, useVorrat: 5 }],
            cost: 200
        },
        unlocks: []
    }
];

// Additional Game Cards - Data from PDF Spielkarten Vorderseiten
const GAME_CARDS = [
    {
        id: 'photovoltaik',
        name: 'Photovoltaik',
        image: 'VorderseitenEinzeln/Photovoltaik.png',
        field: 'dach',
        round: 1,
        sector: 'electricity',
        description: 'Photovoltaikanlagen wandeln Sonnenenergie in elektrische Energie um.',
        effects: {
            replace: [{ tower: 'electricity', from: 'GRID_POWER', to: 'SOLAR', count: 4, useVorrat: 4 }],
            uberschuss: 6,
            reduce: [{ tower: 'electricity', type: 'ANY', count: 0 }],  // "reduziert" shown on card
            cost: -100  // You receive 100 € when playing this card
        }
    },
    {
        id: 'elektroautos',
        name: 'Elektroautos',
        image: 'VorderseitenEinzeln/Elektroautos.png',
        field: 'garage',
        round: 1,
        sector: 'mobility',
        description: '10 % der Autos in der Nachbarschaft werden durch Elektroautos ersetzt.',
        effects: {
            replace: [{ tower: 'mobility', from: 'DIESEL', to: 'SOLAR', count: 6, useUberschuss: 3 }],
            cost: 100
        }
    },
    {
        id: 'e-bike',
        name: 'E-Bike',
        image: 'VorderseitenEinzeln/E-Bike.png',
        field: 'fahrrad',
        round: 1,
        sector: 'mobility',
        description: 'Bei E-Bikes wird der Tritt in die Pedale durch einen elektrischen Motor unterstützt.',
        effects: {
            reduce: [{ tower: 'mobility', type: 'DIESEL', count: 2 }],
            cost: 100
        }
    },
    {
        id: 'waermepumpe',
        name: 'Wärmepumpe',
        image: 'VorderseitenEinzeln/Waermepumpe.png',
        field: 'heizung',
        round: 1,
        sector: 'heat',
        description: 'Wärmepumpen nutzen Strom um dem Boden oder der Umgebungsluft Wärmeenergie zu entziehen.',
        effects: {
            add: [{ tower: 'heat', type: 'GRID_POWER', count: 9 }],  // "addiert" not "replace"
            cost: 1150
        }
    },
    {
        id: 'smart-meter',
        name: 'Smart Meter',
        image: 'VorderseitenEinzeln/Smart_Meter.png',
        field: 'stromzaehler',  // PDF shows "Heizungsraum"
        round: 1,
        requires: ['stromzaehler'],
        sector: 'electricity',
        description: 'Ein digitaler Smart Meter erfasst den Stromverbrauch alle 15 Minuten.',
        effects: {
            add: [],
            cost: 50  // "addiert 50" on card, not "-50"
        },
        unlocks: ['energievisualisierung', 'dynamische-tarife', 'energieberatung']
    },
    {
        id: 'oepnv',
        name: 'ÖPNV-Nutzung',
        image: 'VorderseitenEinzeln/OEPNV-Nutzung.png',
        field: 'nachbarschaft',  // PDF shows "Nachbarschaftsgarage"
        round: 1,
        sector: 'mobility',
        description: 'Eine erhöhte Nutzung des Öffentlichen Personen-Nahverkehrs (ÖPNV) führt zur Einsparung fossiler Energieträger.',
        effects: {
            reduce: [{ tower: 'mobility', type: 'DIESEL', count: 8 }],
            cost: -250,  // "reduziert 250" costs
            faulis: -3
        }
    },
    {
        id: 'kleinstwindkraft',
        name: 'Kleinstwindkraft',
        image: 'VorderseitenEinzeln/Kleinstwindkraft.png',
        field: 'dach',
        round: 1,
        sector: 'electricity',
        description: 'Mit einer Kleinstwindkraftanlage wird die Kraft des Windes in elektrische Energie umgewandelt.',
        effects: {
            replace: [{ tower: 'electricity', from: 'GRID_POWER', to: 'WIND', count: 1, useVorrat: 1 }],
            cost: 0
        }
    },
    {
        id: 'autofreier-sonntag',
        name: 'Autofreier Sonntag',
        image: 'VorderseitenEinzeln/Autofreier_Sonntag.png',
        field: 'komfort',
        round: 1,
        sector: 'mobility',
        description: '2022 waren mehr als die Hälfte der deutschen Bürger*innen für den Autofreien Sonntag.',
        effects: {
            reduce: [{ tower: 'mobility', type: 'DIESEL', count: 3 }],
            cost: -250,
            faulis: -2
        }
    },
    {
        id: 'dynamische-tarife',
        name: 'Dynamische Tarife',
        image: 'VorderseitenEinzeln/Dynamische_Tarife.png',
        field: 'komfort',
        round: 1,
        requires: ['smart-meter'],
        sector: 'electricity',
        description: 'Bei einem Dynamischen Tarif schwankt der Strompreis im Tagesverlauf.',
        effects: {
            replace: [{ tower: 'electricity', from: 'GRID_POWER', to: 'SOLAR', count: 1, useUberschuss: 1 }],
            cost: -50,
            faulis: -1
        }
    },
    {
        id: 'effizientere-geraete',
        name: 'Effizientere Geräte',
        image: 'VorderseitenEinzeln/Effizientere_Geraete.png',
        field: 'haustechnik',
        round: 1,
        sector: 'electricity',
        description: 'Der technische Fortschritt ermöglicht die Entwicklung Effizienterer Geräte.',
        effects: {
            reduce: [{ tower: 'electricity', type: 'ANY', count: 1 }],
            cost: 0
        }
    },
    {
        id: 'energievisualisierung',
        name: 'Energievisualisierung',
        image: 'VorderseitenEinzeln/Energievisualisierung.png',
        field: 'haustechnik',
        round: 1,
        requires: ['smart-meter'],
        sector: 'electricity',
        description: 'Eine Energievisualisierung führt zu einem bewussteren Umgang mit Energie.',
        effects: {
            replace: [{ tower: 'electricity', from: 'ANY', to: 'SOLAR', count: 1 }],
            cost: -50,
            faulis: -1
        }
    },
    {
        id: 'stromspeicher',
        name: 'Stromspeicher',
        image: 'VorderseitenEinzeln/Stromspeicher.png',
        field: 'haustechnik',
        round: 1,
        sector: 'electricity',
        description: 'Dieser Heimstromspeicher dient dazu überschüssige Energie der Photovoltaikanlage nutzbar zu machen.',
        effects: {
            replace: [{ tower: 'electricity', from: 'GRID_POWER', to: 'SOLAR', count: 3, useUberschuss: 3 }],
            cost: 200
        }
    },
    // Round 2 cards
    {
        id: 'kohleausstieg',
        name: 'Kohleausstieg',
        image: 'VorderseitenEinzeln/Kohleausstieg.png',
        field: 'stromnetz',
        round: 2,
        sector: 'electricity',
        policyCard: true,  // Policy cards don't remove stones when replacing - they inherit the grid state
        description: 'Deutschland hat das Kohlezeitalter hinter sich gelassen. Alle schwarzen Steine zählen nur noch als 4t CO₂.',
        effects: {
            replaceAllGridPower: true,  // All GRID_POWER stones count as 4t CO2 instead of 8t (across all towers)
            cost: 0  // No cost - it's a policy change, not an investment
        }
    },
    {
        id: 'mehr-elektroautos',
        name: 'Mehr Elektroautos',
        image: 'VorderseitenEinzeln/Mehr_Elektroautos.png',
        field: 'garage',
        round: 2,
        sector: 'mobility',
        description: 'Weitere 10 % der Autos in der Nachbarschaft werden durch Elektroautos ersetzt.',
        effects: {
            replace: [{ tower: 'mobility', from: 'DIESEL', to: 'SOLAR', count: 6, useUberschuss: 3 }],
            cost: 100
        }
    },
    {
        id: 'waermetauscher',
        name: 'Wärmetauscher',
        image: 'VorderseitenEinzeln/Waermetauscher.png',
        field: 'heizung',
        round: 2,
        requiresOneOf: ['blockheizkraftwerk', 'nachbarschaftswaermepumpe'],  // OR condition
        sector: 'heat',
        description: 'Mit einem Wärmetauscher wird die Nahwärme ins Haus übertragen.',
        effects: {
            add: [],
            cost: 300
        }
    },
    {
        id: 'balkonkraftwerk',
        name: 'Balkonkraftwerk',
        image: 'VorderseitenEinzeln/Balkonkraftwerk.png',
        field: 'balkon',
        round: 2,
        sector: 'electricity',
        description: 'Mit 1 bis 2 Photovoltaik-Modulen können auch Mieter*innen ihren eigenen Strom erzeugen.',
        effects: {
            replace: [{ tower: 'electricity', from: 'GRID_POWER', to: 'SOLAR', count: 1, useVorrat: 1 }],
            cost: 0
        }
    },
    {
        id: 'photovoltaik-2',
        name: 'Photovoltaik',
        image: 'VorderseitenEinzeln/Photovoltaik_2.png',
        field: 'dach',
        round: 2,
        sector: 'electricity',
        description: 'Photovoltaikanlagen wandeln Sonnenenergie in elektrische Energie um.',
        effects: {
            replace: [{ tower: 'electricity', from: 'GRID_POWER', to: 'SOLAR', count: 4, useVorrat: 4 }],
            uberschuss: 6,
            cost: -100  // "100 reduziert" - reduces cost by 100
        }
    },
    {
        id: 'nachbarschaftswaermepumpe',
        name: 'Nachbarschaftswärmepumpe',
        image: 'VorderseitenEinzeln/Nachbarschaftswaermepumpe.png',
        field: 'technikinsel',
        round: 2,
        sector: 'heat',
        description: 'Diese leistungsstärkere Nachbarschaftswärmepumpe wird eingesetzt, um noch effizienter Strom in Wärme zu wandeln.',
        effects: {
            add: [{ tower: 'heat', type: 'GRID_POWER', count: 7 }],
            cost: 750
        },
        unlocks: ['waermetauscher']
    },
    {
        id: 'blockheizkraftwerk',
        name: 'Blockheizkraftwerk',
        image: 'VorderseitenEinzeln/Blockheizkraftwerk.png',
        field: 'technikinsel',
        round: 2,
        sector: 'heat',
        description: 'Das Blockheizkraftwerk erzeugt Wärme für die gesamte Nachbarschaft.',
        effects: {
            add: [{ tower: 'heat', type: 'GAS', count: 32 }],
            replace: [{ tower: 'electricity', from: 'GRID_POWER', to: 'GAS', count: 12, useVorrat: 12 }],
            cost: 200
        },
        unlocks: ['waermetauscher']
    },
    {
        id: 'gemeinsamer-stromspeicher',
        name: 'Gemeinsamer Stromspeicher',
        image: 'VorderseitenEinzeln/Gemeinsamer_Stromspeicher.png',
        field: 'technikinsel',
        round: 2,
        sector: 'electricity',
        description: 'Ein großer elektrischer Speicher in der Nachbarschaft ist effizienter als viele kleine Speicher.',
        effects: {
            replace: [{ tower: 'electricity', from: 'GRID_POWER', to: 'SOLAR', count: 6, useUberschuss: 6 }],
            cost: 150
        }
    },
    {
        id: 'biomethan',
        name: 'Biomethan',
        image: 'VorderseitenEinzeln/Biomethan.png',
        field: 'technikinsel',
        round: 2,
        sector: 'heat',
        description: 'Fossiles Erdgas wird in der Nachbarschaft durch erneuerbares Biomethan ersetzt.',
        effects: {
            reduceCO2Gas: true,  // Special: reduces CO2 value of all gas stones from 4 to 3
            cost: 200
        }
    },
    {
        id: 'elektro-car-sharing',
        name: 'Elektro-Car-Sharing',
        image: 'VorderseitenEinzeln/Elektro-Car-Sharing.png',
        field: 'nachbarschaft',
        round: 2,
        sector: 'mobility',
        description: 'In der Nachbarschaftsgarage steht eine Flotte Elektroautos zur Verfügung.',
        effects: {
            replace: [{ tower: 'mobility', from: 'DIESEL', to: 'SOLAR', count: 6, useUberschuss: 3 }],
            cost: 100,
            faulis: -2
        }
    },
    {
        id: 'gemeinsames-lastenrad',
        name: 'Gemeinsames Lastenrad',
        image: 'VorderseitenEinzeln/Gemeinsames_Lastenrad.png',
        field: 'nachbarschaft',
        round: 2,
        sector: 'mobility',
        description: 'In der Nachbarschaft gibt es ein Gemeinsames Lastenrad.',
        effects: {
            reduce: [{ tower: 'mobility', type: 'DIESEL', count: 2 }],
            cost: -50,
            faulis: -1
        }
    },
    {
        id: 'urlaubsreise-oepnv',
        name: 'Urlaubsreise mit ÖPNV statt Auto',
        image: 'VorderseitenEinzeln/Urlaubsreise_mit_OEPNV.png',
        field: 'komfort',
        round: 2,
        sector: 'mobility',
        description: 'Eine Reise mit dem Bus oder Bahn reduziert den Fahrstress.',
        effects: {
            reduce: [{ tower: 'mobility', type: 'DIESEL', count: 6 }],
            cost: -150,
            faulis: -4
        }
    },
    {
        id: 'vermeidung-standby',
        name: 'Vermeidung von Standby',
        image: 'VorderseitenEinzeln/Vermeidung_von_Standby.png',
        field: 'haustechnik',
        round: 2,
        sector: 'electricity',
        description: 'Das Vermeiden des Standby-Modus bei elektronischen Geräten spart Strom.',
        effects: {
            reduce: [{ tower: 'electricity', type: 'ANY', count: 1 }],
            cost: 0,
            faulis: -1
        }
    },
    // Round 3 cards
    {
        id: '75-prozent-erneuerbare',
        name: '75 % Erneuerbare Energien',
        image: 'VorderseitenEinzeln/75_Prozent_Erneuerbare_Energien.png',
        field: 'stromnetz',
        round: 3,
        sector: 'electricity',
        policyCard: true,  // Policy cards don't remove stones when replacing - they inherit the grid state
        description: 'Die Erneuerbaren Energien werden von ein paar Gaskraftwerken unterstützt. Alle schwarzen Steine zählen nur noch als 2t CO₂.',
        effects: {
            replace75Percent: true,  // All GRID_POWER stones count as 2t CO2 instead of 8t (across all towers)
            cost: 0  // No cost - it's a policy change
        }
    },
    {
        id: 'noch-mehr-elektroautos',
        name: 'Noch mehr Elektroautos!?',
        image: 'VorderseitenEinzeln/Noch_mehr_Elektroautos.png',
        field: 'garage',
        round: 3,
        sector: 'mobility',
        description: 'Weitere 10 % der Autos in der Nachbarschaft werden durch Elektroautos ersetzt.',
        effects: {
            replace: [{ tower: 'mobility', from: 'DIESEL', to: 'SOLAR', count: 6, useUberschuss: 3 }],
            cost: 100
        }
    },
    {
        id: '10-prozent-wasserstoffautos',
        name: '10 % Wasserstoffautos',
        image: 'VorderseitenEinzeln/10_Prozent_Wasserstoffautos.png',
        field: 'garage',
        round: 3,
        requires: ['wasserstoff-erzeugung'],
        sector: 'mobility',
        description: '10 % der Autos in der Nachbarschaft werden durch Wasserstoffautos ersetzt.',
        effects: {
            replace: [{ tower: 'mobility', from: 'DIESEL', to: 'HYDROGEN', count: 6, useH2Uberschuss: 3 }],
            cost: 200
        }
    },
    {
        id: 'wasserstoff-erzeugung',
        name: 'Wasserstofferzeugung',
        image: 'VorderseitenEinzeln/Wasserstofferzeugung.png',
        field: 'technikinsel',
        round: 3,
        sector: 'electricity',
        description: 'Im chemischen Prozess der Elektrolyse wird Wasser durch Strom in Wasserstoff aufgespalten.',
        effects: {
            replace: [{ tower: 'electricity', from: 'ANY', to: 'HYDROGEN', count: 6, useUberschuss: 6 }],
            producesH2Uberschuss: 3,  // Produces 3 H₂ Überschuss for Wasserstoff vehicles
            cost: 200
        },
        unlocks: ['10-prozent-wasserstoffautos', 'wasserstoffbus', 'wasserstoff-car-sharing']
    },
    {
        id: 'gemeinsame-photovoltaik',
        name: 'Gemeinsame Photovoltaik',
        image: 'VorderseitenEinzeln/Gemeinsame_Photovoltaik.png',
        field: 'technikinsel',
        round: 3,
        sector: 'electricity',
        description: 'Diese Photovoltaikanlage benötigt viel Platz.',
        effects: {
            uberschuss: 7,
            cost: -50
        }
    },
    {
        id: 'wasserstoffbus',
        name: 'Wasserstoffbus',
        image: 'VorderseitenEinzeln/Wasserstoffbus.png',
        field: 'nachbarschaft',
        round: 3,
        requires: ['wasserstoff-erzeugung'],
        sector: 'mobility',
        description: 'Eine erhöhte Nutzung des ÖPNV mit Wasserstofftechnologie.',
        effects: {
            replace: [{ tower: 'mobility', from: 'DIESEL', to: 'HYDROGEN', count: 8, useH2Uberschuss: 3 }],
            cost: 0,
            faulis: -3
        }
    },
    {
        id: 'wasserstoff-car-sharing',
        name: 'Wasserstoff-Car-Sharing',
        image: 'VorderseitenEinzeln/Wasserstoff-Car-Sharing.png',
        field: 'nachbarschaft',
        round: 3,
        requires: ['wasserstoff-erzeugung'],
        sector: 'mobility',
        description: 'In der Nachbarschaftsgarage steht eine Flotte Wasserstoffautos zur Verfügung.',
        effects: {
            replace: [{ tower: 'mobility', from: 'DIESEL', to: 'HYDROGEN', count: 6, useH2Uberschuss: 3 }],
            cost: 100,
            faulis: -2
        }
    },
    {
        id: 'e-bike-sharing',
        name: 'E-Bike-Sharing',
        image: 'VorderseitenEinzeln/E-Bike-Sharing.png',
        field: 'nachbarschaft',
        round: 3,
        sector: 'mobility',
        description: 'Die Nachbarschaft wird mit einer E-Bike-Flotte ausgestattet.',
        effects: {
            reduce: [{ tower: 'mobility', type: 'DIESEL', count: 2 }],
            cost: 0,
            faulis: -1
        }
    },
    {
        id: 'home-office',
        name: 'Home Office',
        image: 'VorderseitenEinzeln/Home_Office.png',
        field: 'komfort',
        round: 3,
        sector: 'mobility',
        description: 'Einen Tag Home Office pro Woche reduziert den Verkehr.',
        effects: {
            reduce: [{ tower: 'mobility', type: 'DIESEL', count: 2 }],
            add: [{ tower: 'electricity', type: 'GRID_POWER', count: 1 }],
            cost: 100,
            faulis: 3
        }
    },
    {
        id: 'energieberatung',
        name: 'Energieberatung',
        image: 'VorderseitenEinzeln/Energieberatung.png',
        field: 'komfort',
        round: 3,
        requires: ['smart-meter'],
        sector: 'electricity',
        description: 'Die Daten des Smart Meter können durch Expert*innen ausgewertet werden.',
        effects: {
            reduce: [{ tower: 'electricity', type: 'ANY', count: 1 }],
            cost: 0,
            faulis: -1
        }
    },
    {
        id: 'geringere-innentemperatur',
        name: 'Geringere Innentemperatur',
        image: 'VorderseitenEinzeln/Geringere_Innentemperatur.png',
        field: 'komfort',
        round: 3,
        sector: 'heat',
        description: 'Werden die Innenräume im Winter zwei Grad weniger geheizt, reduziert sich der Wärmebedarf um 10 %.',
        effects: {
            reducePercent: [{ tower: 'heat', type: 'ANY', percent: 10 }],
            cost: -50,
            faulis: -2
        }
    },
    {
        id: 'bessere-waermedaemmung',
        name: 'Bessere Wärmedämmung',
        image: 'VorderseitenEinzeln/Bessere_Waermedaemmung.png',
        field: 'haustechnik',
        round: 3,
        sector: 'heat',
        description: 'Mit Fassaden-, Innen- und Dachdämmung kann der Heizbedarf gesenkt werden.',
        effects: {
            reducePercent: [{ tower: 'heat', type: 'ANY', percent: 20 }],
            cost: 150
        }
    }
];

// Combine all cards
const ALL_CARDS = [...STARTER_CARDS, ...GAME_CARDS];

// Helper function to create a stone with unique ID
function createStone(type, originCardId = null) {
    const stoneType = STONE_TYPES[type];
    if (!stoneType) {
        console.error(`Unknown stone type: ${type}`);
        return null;
    }
    return {
        id: ++gameState.stoneIdCounter,
        type: type,
        originCardId: originCardId, // Which card originally added this stone
        ...stoneType
    };
}

// Helper function to update CO2 impact display
function updateCO2Impact(actionType, cardName) {
    const currentCO2 = calculateTotalCO2();
    const delta = currentCO2 - gameState.lastCO2;

    // Count stones by type for breakdown
    const stoneBreakdown = {};
    ['mobility', 'heat', 'electricity'].forEach(tower => {
        gameState.towers[tower].forEach(stone => {
            if (!stoneBreakdown[stone.type]) {
                stoneBreakdown[stone.type] = { count: 0, co2: 0 };
            }
            stoneBreakdown[stone.type].count++;
            // Calculate effective CO2 based on active cards
            let effectiveCO2 = stone.co2;
            if (stone.type === 'GRID_POWER') {
                if (gameState.playedCards['75-prozent-erneuerbare']) {
                    effectiveCO2 = 2;
                } else if (gameState.playedCards['kohleausstieg']) {
                    effectiveCO2 = 4;
                }
            } else if (stone.type === 'GAS' && gameState.playedCards['biomethan']) {
                effectiveCO2 = 3;
            }
            stoneBreakdown[stone.type].co2 += effectiveCO2;
        });
    });

    gameState.lastAction = {
        type: actionType,
        cardName: cardName,
        co2Before: gameState.lastCO2,
        co2After: currentCO2,
        delta: delta,
        breakdown: stoneBreakdown
    };

    // Update the impact display
    const impactElement = document.getElementById('co2-impact');
    if (impactElement) {
        const actionLabel = actionType === 'play' ? 'Gespielt' : 'Entfernt';
        let html = `<div class="impact-header">${actionLabel}: ${cardName}</div>`;

        if (delta === 0) {
            html += `<div class="impact-neutral">CO₂: ±0t</div>`;
        } else if (delta > 0) {
            html += `<div class="impact-negative">CO₂: +${delta}t</div>`;
        } else {
            html += `<div class="impact-positive">CO₂: ${delta}t</div>`;
        }

        // Add stone breakdown
        html += `<div class="impact-breakdown">`;
        const typeNames = {
            'GRID_POWER': 'Netzstrom',
            'DIESEL': 'Diesel',
            'GAS': 'Gas',
            'SOLAR': 'Solar',
            'WIND': 'Wind',
            'HYDROGEN': 'H₂'
        };
        for (const type in stoneBreakdown) {
            const info = stoneBreakdown[type];
            const name = typeNames[type] || type;
            html += `<div class="breakdown-item">${info.count}x ${name}: ${info.co2}t</div>`;
        }
        html += `</div>`;

        impactElement.innerHTML = html;
    }

    gameState.lastCO2 = currentCO2;
}

// Initialize game
function initGame() {
    log('Spiel initialisiert. Willkommen bei Changing the Game!');
    document.getElementById('start-game').addEventListener('click', startGame);
    document.getElementById('end-round').addEventListener('click', endRound);
    document.getElementById('check-goals').addEventListener('click', checkGoals);

    const overlay = document.getElementById('card-overlay');
    document.querySelector('.close').addEventListener('click', () => {
        overlay.style.display = 'none';
    });
    document.getElementById('cancel-card').addEventListener('click', () => {
        overlay.style.display = 'none';
    });

    // Show Start Zielkarte as active initially
    updateZielkartenDisplay(0);
}

function startGame() {
    log('=== SPIEL STARTET ===');
    gameState.currentRound = 0;
    gameState.faulis = 0;
    gameState.stoneIdCounter = 0; // Reset stone ID counter
    gameState.h2Uberschuss = 0; // Reset H₂ Überschuss

    // Play starter cards
    log('Startkarten werden ausgespielt...');
    STARTER_CARDS.forEach(card => {
        playCard(card, true);
    });

    // Initialize CO2 tracking after starter cards are played
    gameState.lastCO2 = calculateTotalCO2();

    // Start Round 1
    startRound(1);

    document.getElementById('start-game').style.display = 'none';
    document.getElementById('end-round').style.display = 'inline-block';
}

function startRound(roundNumber) {
    gameState.currentRound = roundNumber;
    gameState.faulis += 5;

    log(`=== RUNDE ${roundNumber} BEGINNT ===`);
    log(`Jahr: ${GOAL_CARDS[roundNumber].year}`);
    log(`+5 Faulis erhalten (Gesamt: ${gameState.faulis})`);

    // Update UI
    document.getElementById('current-round').textContent = `${roundNumber} (${GOAL_CARDS[roundNumber].year})`;
    updateFaulisDisplay();

    // Set goals
    updateGoals(roundNumber);

    // Deal cards
    dealCards(roundNumber);

    // Start timer (15 minutes = 900 seconds)
    startTimer(900);
}

function updateGoals(roundNumber) {
    const goals = GOAL_CARDS[roundNumber];
    gameState.goals = goals;

    updateZielkartenDisplay(roundNumber);
    updateCurrentValues();
}

function updateZielkartenDisplay(roundNumber) {
    const slots = document.querySelectorAll('.zielkarte-slot');
    slots.forEach(slot => {
        const slotRound = parseInt(slot.dataset.round);
        slot.classList.remove('active', 'completed', 'revealed');

        if (slotRound === roundNumber) {
            slot.classList.add('active', 'revealed');
        } else if (slotRound < roundNumber) {
            slot.classList.add('completed', 'revealed');
        }
        // Future rounds: no 'revealed' class = shows Rückseite
    });
}

function dealCards(roundNumber) {
    const roundCards = GAME_CARDS.filter(card => card.round === roundNumber);
    gameState.playerHand.push(...roundCards);
    renderPlayerHand();
    log(`${roundCards.length} neue Karten erhalten.`);
}

function startTimer(seconds) {
    gameState.timeRemaining = seconds;
    updateTimerDisplay();

    if (gameState.timer) {
        clearInterval(gameState.timer);
    }

    gameState.timer = setInterval(() => {
        gameState.timeRemaining--;
        updateTimerDisplay();

        if (gameState.timeRemaining <= 0) {
            clearInterval(gameState.timer);
            log('Zeit abgelaufen!', 'error');
            endRound();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(gameState.timeRemaining / 60);
    const seconds = gameState.timeRemaining % 60;
    document.getElementById('time-remaining').textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateFaulisDisplay() {
    document.getElementById('faulis').textContent = gameState.faulis;
}

// Helper functions to identify card types
function isHeatingCard(card) {
    return card.id.includes('heizung') || card.id.includes('waermepumpe') ||
           card.id.includes('blockheizkraftwerk') || card.id.includes('waermetauscher');
}

function isMeterCard(card) {
    return card.id.includes('zaehler') || card.id.includes('meter');
}

// Find all cards that depend on a given card (cards that require this card to be played)
function findDependentCards(cardId) {
    const dependentCards = [];

    for (const playedCardId in gameState.playedCards) {
        const playedCard = gameState.playedCards[playedCardId];
        if (!playedCard) continue;

        // Check if this card requires the card being removed
        if (playedCard.requires && playedCard.requires.includes(cardId)) {
            dependentCards.push(playedCard);
        }

        // Check requiresOneOf - only add if this is the ONLY requirement met
        if (playedCard.requiresOneOf && playedCard.requiresOneOf.includes(cardId)) {
            // Check if any other requirement is still met
            const otherRequirementMet = playedCard.requiresOneOf.some(reqId =>
                reqId !== cardId && gameState.playedCards[reqId]
            );
            if (!otherRequirementMet) {
                dependentCards.push(playedCard);
            }
        }
    }

    return dependentCards;
}

// Recursively find all dependent cards (including cards that depend on dependent cards)
function findAllDependentCards(cardId, visited = new Set()) {
    if (visited.has(cardId)) return [];
    visited.add(cardId);

    const directDependents = findDependentCards(cardId);
    const allDependents = [...directDependents];

    // Recursively find dependents of dependents
    for (const depCard of directDependents) {
        const nestedDependents = findAllDependentCards(depCard.id, visited);
        allDependents.push(...nestedDependents);
    }

    return allDependents;
}

function canPlayCardInField(card) {
    const field = card.field;
    const fieldLimit = FIELD_LIMITS[field];

    if (!fieldLimit) {
        log(`⚠️ Unbekanntes Feld: ${field}`, 'error');
        return false;
    }

    // Initialize field occupancy if not exists
    if (!gameState.fieldOccupancy[field]) {
        gameState.fieldOccupancy[field] = [];
    }

    const currentOccupancy = gameState.fieldOccupancy[field].length;

    // Special handling for Heizungsraum (separate heating and meter cards)
    if (field === 'heizung') {
        const heatingCardsInRoom = gameState.fieldOccupancy[field].filter(cardId => {
            const c = gameState.playedCards[cardId];
            return c && isHeatingCard(c);
        }).length;

        const meterCardsInRoom = gameState.fieldOccupancy[field].filter(cardId => {
            const c = gameState.playedCards[cardId];
            return c && isMeterCard(c);
        }).length;

        const isHeating = isHeatingCard(card);
        const isMeter = isMeterCard(card);

        if (isHeating && heatingCardsInRoom >= fieldLimit.heatingLimit) {
            // Will replace the existing heating card
            return 'replace-heating';
        }

        if (isMeter && meterCardsInRoom >= fieldLimit.meterLimit) {
            // Will replace the existing meter card
            return 'replace-meter';
        }

        return true;
    }

    // Special handling for garage (car limit only)
    if (field === 'garage') {
        const carsInGarage = gameState.fieldOccupancy[field].filter(cardId => {
            const c = gameState.playedCards[cardId];
            return c && (c.id.includes('auto') || c.id.includes('elektro'));
        }).length;

        if (carsInGarage >= fieldLimit.carLimit) {
            log(`Garage voll: Maximal ${fieldLimit.carLimit} Autos erlaubt (aktuell: ${carsInGarage})`, 'error');
            return false;
        }

        return true;
    }

    // Special handling for fahrrad field (bike limit)
    if (field === 'fahrrad') {
        const bikesInField = gameState.fieldOccupancy[field].filter(cardId => {
            const c = gameState.playedCards[cardId];
            return c && (c.id.includes('fahrrad') || c.id.includes('bike'));
        }).length;

        if (bikesInField >= fieldLimit.bikeLimit) {
            log(`Fahrrad-Feld voll: Maximal ${fieldLimit.bikeLimit} Fahrräder erlaubt (aktuell: ${bikesInField})`, 'error');
            return false;
        }

        return true;
    }

    // For mandatory single-card fields (max: 1), allow replacement
    if (fieldLimit.max === 1 && fieldLimit.required && currentOccupancy >= 1) {
        // Will replace the existing card
        return 'replace';
    }

    // Check general field limit
    if (currentOccupancy >= fieldLimit.max) {
        log(`Feld "${fieldLimit.description}" voll: Maximal ${fieldLimit.max} Karten erlaubt`, 'error');
        return false;
    }

    return true;
}

function reverseCardEffects(card) {
    const history = gameState.cardPlayHistory[card.id];
    const effects = card.effects;

    // If no history exists (card played before this feature), use legacy function
    if (!history) {
        console.log(`[HISTORY] No history found for ${card.name}, using legacy reversal`);
        return reverseCardEffectsLegacy(card);
    }

    console.log(`[HISTORY] Using history-based reversal for ${card.name}:`, history);

    // Reverse special effect: Kohleausstieg (just logging, stones don't change)
    if (effects.replaceAllGridPower) {
        let gridPowerCount = 0;
        const towersToCheck = ['mobility', 'heat', 'electricity'];
        towersToCheck.forEach(towerName => {
            const tower = gameState.towers[towerName];
            const count = tower.filter(stone => stone.type === 'GRID_POWER').length;
            if (count > 0) {
                log(`  Kohleausstieg rückgängig: ${count} schwarze Steine in ${towerName} zählen wieder als 8t CO₂`);
            }
            gridPowerCount += count;
        });
        if (gridPowerCount > 0) {
            log(`  Total rückgängig: ${gridPowerCount} schwarze Steine (CO₂: 4t → 8t)`);
        }
    }

    // Reverse special effect: 75% Erneuerbare (just logging, stones don't change)
    if (effects.replace75Percent) {
        let gridPowerCount = 0;
        const towersToCheck = ['mobility', 'heat', 'electricity'];
        const kohleausstiegActive = gameState.playedCards['kohleausstieg'] !== undefined;
        towersToCheck.forEach(towerName => {
            const tower = gameState.towers[towerName];
            const count = tower.filter(stone => stone.type === 'GRID_POWER').length;
            if (count > 0) {
                const targetCO2 = kohleausstiegActive ? '4t' : '8t';
                log(`  75% Erneuerbare rückgängig: ${count} schwarze Steine in ${towerName} zählen wieder als ${targetCO2} CO₂`);
            }
            gridPowerCount += count;
        });
        if (gridPowerCount > 0) {
            const targetCO2 = kohleausstiegActive ? '4t' : '8t';
            log(`  Total rückgängig: ${gridPowerCount} schwarze Steine (CO₂: 2t → ${targetCO2})`);
        }
    }

    // Remove stones that were added (using exact history with ID-based removal)
    if (history.stonesAdded.length > 0) {
        history.stonesAdded.forEach(entry => {
            const tower = gameState.towers[entry.tower];
            let removedCount = 0;
            let notFoundCount = 0;
            // Remove each stone that was added, preferring ID-based removal
            entry.stones.forEach(stone => {
                let found = false;
                // First try to find by ID (new system)
                if (stone.id !== undefined) {
                    for (let i = tower.length - 1; i >= 0; i--) {
                        if (tower[i].id === stone.id) {
                            tower.splice(i, 1);
                            removedCount++;
                            found = true;
                            break;
                        }
                    }
                }
                // Fallback: find by type (for backward compatibility or if ID not found)
                if (!found) {
                    for (let i = tower.length - 1; i >= 0; i--) {
                        if (tower[i].type === stone.type) {
                            tower.splice(i, 1);
                            removedCount++;
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) {
                    notFoundCount++;
                    console.warn(`[REVERSAL] Could not find stone to remove: type=${stone.type}, id=${stone.id}`);
                }
            });
            const typeCounts = {};
            entry.stones.forEach(s => {
                typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
            });
            const typeStr = Object.entries(typeCounts).map(([t, c]) => `${c}x ${STONE_TYPES[t]?.name || t}`).join(', ');
            log(`  -${removedCount} Steine von ${entry.tower} entfernt (${typeStr})`);
            if (notFoundCount > 0) {
                log(`  ⚠️ ${notFoundCount} Steine konnten nicht gefunden werden (wurden möglicherweise durch andere Karten umgewandelt)`, 'warning');
            }
        });
    }

    // Re-add stones that were removed (using exact history - preserves exact types and IDs)
    if (history.stonesRemoved.length > 0) {
        history.stonesRemoved.forEach(entry => {
            const tower = gameState.towers[entry.tower];
            let addedCount = 0;
            entry.stones.forEach(stone => {
                const stoneType = STONE_TYPES[stone.type];
                if (stoneType) {
                    // Recreate stone with original ID and origin if available
                    const restoredStone = {
                        id: stone.id !== undefined ? stone.id : ++gameState.stoneIdCounter,
                        type: stone.type,
                        originCardId: stone.originCardId,
                        ...stoneType
                    };
                    tower.push(restoredStone);
                    addedCount++;
                }
            });
            const typeCounts = {};
            entry.stones.forEach(s => {
                typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
            });
            const typeStr = Object.entries(typeCounts).map(([t, c]) => `${c}x ${STONE_TYPES[t]?.name || t}`).join(', ');
            log(`  +${addedCount} Steine zu ${entry.tower} zurückgefügt (${typeStr})`);
        });
    }

    // Remove Überschuss that was added by this card
    if (effects.uberschuss || gameState.uberschuss[card.id]) {
        const removedAmount = gameState.uberschuss[card.id] || 0;
        delete gameState.uberschuss[card.id];

        // De-optimize cards that were using this Überschuss
        if (removedAmount > 0) {
            deoptimizeWithRemovedUberschuss(removedAmount);
        }
    }

    // Clean up unmet Überschuss tracking for this card
    if (gameState.unmetUberschuss[card.id]) {
        delete gameState.unmetUberschuss[card.id];
    }

    // Return used Überschuss when removing a card that consumed it
    if (gameState.uberschussUsage[card.id]) {
        const usedAmount = gameState.uberschussUsage[card.id].uberschussUsed;
        if (usedAmount > 0) {
            // Return Überschuss to cards that generate it
            returnUberschuss(usedAmount);
            log(`  ♻️ ${usedAmount} Überschuss zurückgegeben (wurde von ${card.name} verwendet)`, 'success');
            showNotification(`♻️ ${usedAmount} Überschuss zurückgegeben (wurde von ${card.name} verwendet)`, 'success', 5000);
        }
        delete gameState.uberschussUsage[card.id];
    }

    // Remove H₂ Überschuss that was produced by this card (e.g., Wasserstofferzeugung)
    if (history.h2UberschussProduced && history.h2UberschussProduced > 0) {
        gameState.h2Uberschuss -= history.h2UberschussProduced;
        if (gameState.h2Uberschuss < 0) gameState.h2Uberschuss = 0;
        log(`  -${history.h2UberschussProduced} H₂ Überschuss entfernt`);
    }

    // Return H₂ Überschuss when removing a card that consumed it (e.g., Wasserstoffautos)
    if (history.h2UberschussUsed && history.h2UberschussUsed > 0) {
        gameState.h2Uberschuss += history.h2UberschussUsed;
        log(`  ♻️ ${history.h2UberschussUsed} H₂ Überschuss zurückgegeben (wurde von ${card.name} verwendet)`, 'success');
        showNotification(`♻️ ${history.h2UberschussUsed} H₂ Überschuss zurückgegeben`, 'success', 5000);
    }

    // Reverse costs using exact recorded change
    if (history.costChange !== 0) {
        const costChange = -history.costChange; // Reverse the change
        if (costChange > 0) {
            addCostStones(costChange);
            log(`  +${costChange}€ Kosten zurückerstattet`);
        } else {
            removeCostStones(-costChange);
            log(`  -${-costChange}€ Kosten entfernt`);
        }
    }

    // Reverse Faulis using exact recorded change
    if (history.faulisChange !== 0) {
        const fauliChange = -history.faulisChange; // Reverse the change
        gameState.faulis += fauliChange;
        log(`  Faulis zurückerstattet: ${fauliChange > 0 ? '+' : ''}${fauliChange} (Gesamt: ${gameState.faulis})`);
        updateFaulisDisplay();
    }

    // Clean up history for this card
    delete gameState.cardPlayHistory[card.id];

    renderTowers();
}

// Reverse only non-stone effects (for policy cards that inherit stones from previous card)
function reverseCardEffectsNonStone(card) {
    const history = gameState.cardPlayHistory[card.id];
    const effects = card.effects;

    log(`[POLICY] Reversing non-stone effects for ${card.name} (stones stay on board)`);

    // Skip stone reversal - stones stay on the board

    // Reverse Überschuss effects
    if (effects.uberschuss || gameState.uberschuss[card.id]) {
        const removedAmount = gameState.uberschuss[card.id] || 0;
        delete gameState.uberschuss[card.id];
        if (removedAmount > 0) {
            deoptimizeWithRemovedUberschuss(removedAmount);
            log(`  -${removedAmount} Überschuss entfernt (von ${card.name})`);
        }
    }

    // Clean up unmet uberschuss tracking
    if (gameState.unmetUberschuss[card.id]) {
        delete gameState.unmetUberschuss[card.id];
    }

    // Return used Überschuss
    if (gameState.uberschussUsage[card.id]) {
        const usedAmount = gameState.uberschussUsage[card.id].uberschussUsed;
        if (usedAmount > 0) {
            returnUberschuss(usedAmount);
            log(`  ♻️ ${usedAmount} Überschuss zurückgegeben`);
        }
        delete gameState.uberschussUsage[card.id];
    }

    // Reverse costs (if history exists)
    if (history && history.costChange !== 0) {
        const costChange = -history.costChange;
        if (costChange > 0) {
            addCostStones(costChange);
            log(`  +${costChange}€ Kosten zurückerstattet`);
        } else {
            removeCostStones(-costChange);
            log(`  -${-costChange}€ Kosten entfernt`);
        }
    }

    // Reverse Faulis (if history exists)
    if (history && history.faulisChange !== 0) {
        const fauliChange = -history.faulisChange;
        gameState.faulis += fauliChange;
        log(`  Faulis: ${fauliChange > 0 ? '+' : ''}${fauliChange} (Gesamt: ${gameState.faulis})`);
        updateFaulisDisplay();
    }

    // Clean up history for this card
    if (history) {
        delete gameState.cardPlayHistory[card.id];
    }

    renderTowers();
}

// Legacy reversal function for cards played before history tracking was implemented
function reverseCardEffectsLegacy(card) {
    const effects = card.effects;

    // Reverse special effect: Kohleausstieg
    // NOTE: Stones never changed, so nothing to reverse - just log
    if (effects.replaceAllGridPower) {
        let gridPowerCount = 0;
        const towersToCheck = ['mobility', 'heat', 'electricity'];

        // Count GRID_POWER stones (just for logging)
        towersToCheck.forEach(towerName => {
            const tower = gameState.towers[towerName];
            const count = tower.filter(stone => stone.type === 'GRID_POWER').length;
            if (count > 0) {
                log(`  Kohleausstieg rückgängig: ${count} schwarze Steine in ${towerName} zählen wieder als 8t CO₂`);
            }
            gridPowerCount += count;
        });

        if (gridPowerCount > 0) {
            log(`  Total rückgängig: ${gridPowerCount} schwarze Steine (CO₂: 4t → 8t)`);
        }
    }

    // Reverse special effect: 75% Erneuerbare
    // NOTE: Stones never changed, so nothing to reverse - just log
    if (effects.replace75Percent) {
        let gridPowerCount = 0;
        const towersToCheck = ['mobility', 'heat', 'electricity'];
        const kohleausstiegActive = gameState.playedCards['kohleausstieg'] !== undefined;

        // Count GRID_POWER stones (just for logging)
        towersToCheck.forEach(towerName => {
            const tower = gameState.towers[towerName];
            const count = tower.filter(stone => stone.type === 'GRID_POWER').length;
            if (count > 0) {
                const targetCO2 = kohleausstiegActive ? '4t' : '8t';
                log(`  75% Erneuerbare rückgängig: ${count} schwarze Steine in ${towerName} zählen wieder als ${targetCO2} CO₂`);
            }
            gridPowerCount += count;
        });

        if (gridPowerCount > 0) {
            const targetCO2 = kohleausstiegActive ? '4t' : '8t';
            log(`  Total rückgängig: ${gridPowerCount} schwarze Steine (CO₂: 2t → ${targetCO2})`);
        }
    }

    // Reverse added stones
    if (effects.add) {
        effects.add.forEach(effect => {
            const tower = gameState.towers[effect.tower];
            const stoneType = STONE_TYPES[effect.type];
            // Remove the stones that were added
            let removed = 0;
            for (let i = tower.length - 1; i >= 0 && removed < effect.count; i--) {
                if (tower[i].type === effect.type) {
                    tower.splice(i, 1);
                    removed++;
                }
            }
            log(`  -${removed} ${stoneType.name} Steine von ${effect.tower} entfernt`);
        });
    }

    // Reverse replaced stones - replace them back
    if (effects.replace) {
        effects.replace.forEach(effect => {
            const tower = gameState.towers[effect.tower];
            const toType = STONE_TYPES[effect.to];
            const fromType = effect.from; // The original type
            let reversed = 0;

            // If the card used Überschuss, it may have added both clean energy and grid power
            if (effect.useUberschuss) {
                // We need to remove useUberschuss stones (not effect.count!)
                // These are the stones that were ADDED (SOLAR/WIND/HYDROGEN or GRID_POWER)
                const stonesToRemove = effect.useUberschuss;

                // Remove SOLAR/WIND/HYDROGEN stones (clean energy from Überschuss)
                for (let i = tower.length - 1; i >= 0 && reversed < stonesToRemove; i--) {
                    if (tower[i].type === effect.to) {
                        tower.splice(i, 1);
                        reversed++;
                    }
                }
                // Remove GRID_POWER stones (used when not enough Überschuss)
                for (let i = tower.length - 1; i >= 0 && reversed < stonesToRemove; i--) {
                    if (tower[i].type === 'GRID_POWER') {
                        tower.splice(i, 1);
                        reversed++;
                    }
                }

                // Now add back the ORIGINAL stones (effect.count of them)
                const stonesToAddBack = effect.count;
                if (fromType !== 'ANY' && STONE_TYPES[fromType]) {
                    for (let i = 0; i < stonesToAddBack; i++) {
                        tower.push(createStone(fromType, null));
                    }
                    log(`  Rückgängig: Entfernt ${reversed} ${toType.name}, wiederhergestellt ${stonesToAddBack} ${STONE_TYPES[fromType].name}`);
                } else {
                    log(`  Entfernt: ${reversed} Steine (Original unbekannt)`);
                }
            } else {
                // Remove the new stones (that were added by replace)
                for (let i = tower.length - 1; i >= 0 && reversed < effect.count; i--) {
                    if (tower[i].type === effect.to) {
                        tower.splice(i, 1);
                        reversed++;
                    }
                }

                // Add back the original stones (if we know what they were)
                if (fromType !== 'ANY' && STONE_TYPES[fromType]) {
                    for (let i = 0; i < reversed; i++) {
                        tower.push(createStone(fromType, null));
                    }
                    log(`  Rückgängig: ${reversed} ${toType.name} → ${STONE_TYPES[fromType].name}`);
                } else if (fromType === 'GRID_POWER' && STONE_TYPES['GRID_POWER']) {
                    // Special case for GRID_POWER
                    for (let i = 0; i < reversed; i++) {
                        tower.push(createStone('GRID_POWER', null));
                    }
                    log(`  Rückgängig: ${reversed} Steine → ${STONE_TYPES['GRID_POWER'].name}`);
                } else if (fromType === 'ANY') {
                    // For 'ANY', determine default stone type based on tower
                    let defaultType = 'GRID_POWER';
                    if (effect.tower === 'mobility') {
                        defaultType = 'DIESEL';
                    } else if (effect.tower === 'heat') {
                        defaultType = 'GAS';
                    }
                    for (let i = 0; i < reversed; i++) {
                        tower.push(createStone(defaultType, null));
                    }
                    log(`  Rückgängig: ${reversed} ${toType.name} → ${STONE_TYPES[defaultType].name}`);
                } else {
                    // Fallback - shouldn't happen
                    log(`  Entfernt: ${reversed} Steine (Original unbekannt)`);
                }
            }
        });
    }

    // Reverse reduced stones - add them back
    if (effects.reduce) {
        effects.reduce.forEach(effect => {
            const tower = gameState.towers[effect.tower];

            // Add back the stones that were removed
            if (effect.type !== 'ANY' && STONE_TYPES[effect.type]) {
                for (let i = 0; i < effect.count; i++) {
                    tower.push(createStone(effect.type, null));
                }
                log(`  +${effect.count} ${STONE_TYPES[effect.type].name} Steine zu ${effect.tower} zurückgefügt`);
            } else {
                log(`  ⚠️ ${effect.count} Steine vom Typ ANY können nicht präzise zurückgefügt werden`);
            }
        });
    }

    // Remove Überschuss
    if (effects.uberschuss || gameState.uberschuss[card.id]) {
        const removedAmount = gameState.uberschuss[card.id] || 0;
        delete gameState.uberschuss[card.id];

        // De-optimize cards that were using this Überschuss
        if (removedAmount > 0) {
            deoptimizeWithRemovedUberschuss(removedAmount);
        }
    }

    // Clean up unmet Überschuss tracking for this card
    if (gameState.unmetUberschuss[card.id]) {
        delete gameState.unmetUberschuss[card.id];
    }

    // Return used Überschuss when removing a card that consumed it
    if (gameState.uberschussUsage[card.id]) {
        const usedAmount = gameState.uberschussUsage[card.id].uberschussUsed;
        if (usedAmount > 0) {
            // Return Überschuss to cards that generate it
            returnUberschuss(usedAmount);
            log(`  ♻️ ${usedAmount} Überschuss zurückgegeben (wurde von ${card.name} verwendet)`, 'success');
            showNotification(`♻️ ${usedAmount} Überschuss zurückgegeben (wurde von ${card.name} verwendet)`, 'success', 5000);
        }
        delete gameState.uberschussUsage[card.id];
    }

    // Reverse costs
    if (effects.cost) {
        const costChange = -effects.cost; // Reverse the change
        if (costChange > 0) {
            addCostStones(costChange);
            log(`  +${costChange}€ Kosten zurückerstattet`);
        } else {
            removeCostStones(-costChange);
            log(`  -${-costChange}€ Kosten entfernt`);
        }
    }

    // Reverse Faulis
    if (effects.faulis) {
        const fauliChange = -effects.faulis; // Reverse the change
        gameState.faulis += fauliChange;
        log(`  Faulis zurückerstattet: ${fauliChange > 0 ? '+' : ''}${fauliChange} (Gesamt: ${gameState.faulis})`);
        updateFaulisDisplay();
    }

    renderTowers();
}

function playCard(card, isStarter = false) {
    log(`Karte wird gespielt: ${card.name}`);

    // Capture CO2 before playing for impact display
    const co2Before = calculateTotalCO2();

    // Check field limits
    const canPlay = canPlayCardInField(card);
    if (canPlay === false) {
        return false;
    }

    // Check requirements BEFORE replacement (important for cards that replace their own requirements)
    if (!isStarter) {
        // Check AND requirements (all must be present)
        if (card.requires) {
            const requirementsMet = card.requires.every(reqId => gameState.playedCards[reqId]);
            if (!requirementsMet) {
                const missing = card.requires.filter(reqId => !gameState.playedCards[reqId]);
                log(`Anforderungen nicht erfüllt für ${card.name}: ${missing.join(', ')} fehlt`, 'error');
                return false;
            }
        }

        // Check OR requirements (at least one must be present)
        if (card.requiresOneOf) {
            const requirementMet = card.requiresOneOf.some(reqId => gameState.playedCards[reqId]);
            if (!requirementMet) {
                log(`Anforderungen nicht erfüllt für ${card.name}: Benötigt mindestens eine von: ${card.requiresOneOf.join(', ')}`, 'error');
                return false;
            }
        }
    }

    // Handle replacement for mandatory single-card fields
    if (canPlay === 'replace' || canPlay === 'replace-heating' || canPlay === 'replace-meter') {
        const field = card.field;
        let existingCard = null;

        // Find the card to replace based on type
        if (canPlay === 'replace-heating') {
            // Find and replace the heating card
            const heatingCardId = gameState.fieldOccupancy[field].find(cardId => {
                const c = gameState.playedCards[cardId];
                return c && isHeatingCard(c);
            });
            existingCard = gameState.playedCards[heatingCardId];
        } else if (canPlay === 'replace-meter') {
            // Find and replace the meter card
            const meterCardId = gameState.fieldOccupancy[field].find(cardId => {
                const c = gameState.playedCards[cardId];
                return c && isMeterCard(c);
            });
            existingCard = gameState.playedCards[meterCardId];
        } else {
            // Simple replacement (single card field)
            const existingCardId = gameState.fieldOccupancy[field][0];
            existingCard = gameState.playedCards[existingCardId];
        }

        if (existingCard) {
            // Check for dependent cards before replacing
            const dependentCards = findAllDependentCards(existingCard.id);
            if (dependentCards.length > 0) {
                const dependentNames = dependentCards.map(c => c.name).join(', ');
                const confirmMessage = `Achtung! Wenn Sie "${existingCard.name}" durch "${card.name}" ersetzen, müssen auch folgende abhängige Karten entfernt werden:\n\n${dependentNames}\n\nDiese Karten benötigen "${existingCard.name}" als Voraussetzung (Schlüssel-Symbol).\n\nMöchten Sie wirklich fortfahren?`;

                if (!confirm(confirmMessage)) {
                    log(`Ersetzung von ${existingCard.name} abgebrochen (abhängige Karten: ${dependentNames})`, 'info');
                    return false;
                }

                // Remove all dependent cards first
                log(`🔗 Entferne abhängige Karten: ${dependentNames}`, 'info');
                for (const depCard of dependentCards.reverse()) {
                    removeCardWithoutDependencyCheck(depCard);
                }
            }

            log(`Ersetze ${existingCard.name} mit ${card.name}`);

            // Policy cards (like Kohleausstieg, 75% Erneuerbare) inherit the grid state
            // They don't reverse stone effects - only the CO2 calculation changes
            if (card.policyCard) {
                log(`  ${card.name} ist eine Policy-Karte: Steine bleiben erhalten, nur CO₂-Berechnung ändert sich`);
                // Only reverse non-stone effects (cost, faulis, etc.)
                reverseCardEffectsNonStone(existingCard);
            } else {
                // Normal replacement - reverse all effects including stones
                reverseCardEffects(existingCard);
            }

            // Remove from played cards
            delete gameState.playedCards[existingCard.id];
            // Remove from field occupancy
            const index = gameState.fieldOccupancy[field].indexOf(existingCard.id);
            if (index > -1) {
                gameState.fieldOccupancy[field].splice(index, 1);
            }
            // Remove from board
            removeCardFromBoard(existingCard);
            // Add back to player hand (including starter cards so they can be replayed)
            gameState.playerHand.push(existingCard);
            renderPlayerHand();

            // Show notification for the replaced card
            if (!card.policyCard) {
                const replacedSummary = buildCardEffectSummary(existingCard, 'remove');
                if (replacedSummary) {
                    showNotification(`🔄 ${existingCard.name} ersetzt: ${replacedSummary}`, 'info', 5000);
                }
            } else {
                showNotification(`🔄 ${existingCard.name} → ${card.name}: Steine bleiben, CO₂-Berechnung ändert sich`, 'info', 5000);
            }
        }
    }

    // Check and pay Faulis
    if (card.effects.faulis) {
        const fauliChange = card.effects.faulis; // Negative means cost, positive means gain
        const fauliCost = -fauliChange; // If card.effects.faulis = -3, cost is 3

        if (fauliCost > 0 && gameState.faulis < fauliCost) {
            log(`Nicht genügend Faulis! Benötigt: ${fauliCost}, Verfügbar: ${gameState.faulis}`, 'error');
            return false;
        }

        gameState.faulis += fauliChange; // Add positive or subtract negative
        log(`Faulis: ${fauliChange > 0 ? '+' : ''}${fauliChange} (Gesamt: ${gameState.faulis})`);
        updateFaulisDisplay();
    }

    // Apply effects - may return false if user cancels (e.g., not enough Überschuss)
    const effectsApplied = applyCardEffects(card);

    if (effectsApplied === false) {
        // User cancelled - reverse any faulis changes we made
        if (card.effects.faulis) {
            const fauliChange = card.effects.faulis;
            gameState.faulis -= fauliChange; // Reverse the change
            log(`  Faulis zurückgesetzt: ${-fauliChange > 0 ? '+' : ''}${-fauliChange} (Gesamt: ${gameState.faulis})`);
            updateFaulisDisplay();
        }
        return false;
    }

    // Mark as played
    gameState.playedCards[card.id] = card;

    // Track that this card has been played at least once
    gameState.everPlayedCards.add(card.id);

    // Track field occupancy
    if (!gameState.fieldOccupancy[card.field]) {
        gameState.fieldOccupancy[card.field] = [];
    }
    gameState.fieldOccupancy[card.field].push(card.id);

    // Add card to board slot
    addCardToBoard(card);

    // Remove from hand if not starter
    if (!isStarter) {
        const index = gameState.playerHand.findIndex(c => c.id === card.id);
        if (index > -1) {
            gameState.playerHand.splice(index, 1);
            renderPlayerHand();
        }
    }

    log(`✓ ${card.name} erfolgreich gespielt`, 'success');

    // Show notification with summary of what the card cost/provided
    const summary = buildCardEffectSummary(card, 'play');
    if (summary) {
        showNotification(`🎴 ${card.name}: ${summary}`, 'info', 5000);
    }

    updateCurrentValues();

    // Update CO2 impact display
    gameState.lastCO2 = co2Before;
    updateCO2Impact('play', card.name);

    return true;
}

function updateFieldLimitDisplays() {
    Object.keys(FIELD_LIMITS).forEach(fieldName => {
        const fieldSlot = document.querySelector(`.field-slot[data-field="${fieldName}"]`);
        if (!fieldSlot) return;

        const limitSpan = fieldSlot.querySelector('.field-limit');
        if (!limitSpan) return;

        const occupancy = gameState.fieldOccupancy[fieldName] ? gameState.fieldOccupancy[fieldName].length : 0;
        const limit = FIELD_LIMITS[fieldName];

        // Special handling for Heizungsraum
        if (fieldName === 'heizung') {
            const heatingCardsInRoom = gameState.fieldOccupancy[fieldName] ?
                gameState.fieldOccupancy[fieldName].filter(cardId => {
                    const c = gameState.playedCards[cardId];
                    return c && isHeatingCard(c);
                }).length : 0;
            limitSpan.textContent = `(Heizung: ${heatingCardsInRoom}/${limit.heatingLimit})`
        }
        if (fieldName === 'stromzaehler') {
            const meterCardsInRoom = gameState.fieldOccupancy[fieldName] ?
                gameState.fieldOccupancy[fieldName].filter(cardId => {
                    const c = gameState.playedCards[cardId];
                    return c && isMeterCard(c);
                }).length : 0;

            limitSpan.textContent = `(Zähler: ${meterCardsInRoom}/${limit.meterLimit})`;
        }

        // Special handling for garage
        if (fieldName === 'garage') {
            const carsInGarage = gameState.fieldOccupancy[fieldName] ?
                gameState.fieldOccupancy[fieldName].filter(cardId => {
                    const c = gameState.playedCards[cardId];
                    return c && (c.id.includes('auto') || c.id.includes('elektro'));
                }).length : 0;
            limitSpan.textContent = `(Autos: ${carsInGarage}/${limit.carLimit})`;
        }
        else if (fieldName === 'fahrrad') {
            const bikesInField = gameState.fieldOccupancy[fieldName] ?
                gameState.fieldOccupancy[fieldName].filter(cardId => {
                    const c = gameState.playedCards[cardId];
                    return c && (c.id.includes('fahrrad') || c.id.includes('bike'));
                }).length : 0;

            limitSpan.textContent = `(Fahrräder: ${bikesInField}/${limit.bikeLimit})`;
        } else {
            const maxDisplay = limit.max === Infinity ? '∞' : limit.max;
            limitSpan.textContent = `(${occupancy}/${maxDisplay})`;
        }
    });
}

function addCardToBoard(card) {
    // Find the appropriate field slot
    const fieldSlot = document.querySelector(`.field-slot[data-field="${card.field}"]`);
    if (!fieldSlot) return;

    const cardSlot = fieldSlot.querySelector('.card-slot, .card-slot-multiple');
    if (!cardSlot) return;

    // Create mini card element with image
    const miniCard = document.createElement('div');
    miniCard.className = 'mini-card';
    miniCard.title = card.name;

    if (card.image) {
        const img = document.createElement('img');
        img.src = card.image;
        img.alt = card.name;
        img.className = 'mini-card-image';
        miniCard.appendChild(img);
    } else {
        // Fallback to text if no image
        miniCard.innerHTML = `<span>${card.name.substring(0, 8)}${card.name.length > 8 ? '...' : ''}</span>`;
    }

    // Add click handler to show details
    miniCard.addEventListener('click', (e) => {
        e.stopPropagation();
        showPlayedCardDetail(card);
    });

    cardSlot.appendChild(miniCard);

    // Update field limit displays
    updateFieldLimitDisplays();
}

// Build a summary of what a card costs/provides for notifications
function buildCardEffectSummary(card, action = 'play') {
    const effects = card.effects;
    const parts = [];

    if (action === 'play') {
        // Cost
        if (effects.cost) {
            if (effects.cost > 0) {
                parts.push(`+${effects.cost}€ Kosten`);
            } else if (effects.cost < 0) {
                parts.push(`${effects.cost}€ (Ersparnis)`);
            }
        }

        // Faulis
        if (effects.faulis) {
            if (effects.faulis > 0) {
                parts.push(`+${effects.faulis} Faulis`);
            } else {
                parts.push(`${effects.faulis} Faulis`);
            }
        }

        // Überschuss generated
        if (effects.uberschuss) {
            parts.push(`+${effects.uberschuss} Überschuss`);
        }

        // Überschuss used
        if (effects.replace) {
            effects.replace.forEach(effect => {
                if (effect.useUberschuss) {
                    parts.push(`-${effect.useUberschuss} Überschuss benötigt`);
                }
            });
        }

        // Stones added
        if (effects.add) {
            effects.add.forEach(effect => {
                const stoneType = STONE_TYPES[effect.type];
                parts.push(`+${effect.count} ${stoneType.name}`);
            });
        }

        // Stones replaced
        if (effects.replace) {
            effects.replace.forEach(effect => {
                const toType = STONE_TYPES[effect.to];
                parts.push(`${effect.count} Steine → ${toType.name}`);
            });
        }

        // Stones reduced
        if (effects.reduce) {
            effects.reduce.forEach(effect => {
                if (effect.count > 0) {
                    parts.push(`-${effect.count} Steine`);
                }
            });
        }
    } else if (action === 'remove') {
        // Refunds when removing
        if (effects.cost) {
            if (effects.cost > 0) {
                parts.push(`-${effects.cost}€ zurück`);
            } else if (effects.cost < 0) {
                parts.push(`+${-effects.cost}€ Kosten`);
            }
        }

        // Faulis refunded
        if (effects.faulis) {
            if (effects.faulis < 0) {
                parts.push(`+${-effects.faulis} Faulis zurück`);
            } else {
                parts.push(`-${effects.faulis} Faulis`);
            }
        }

        // Überschuss removed
        if (effects.uberschuss) {
            parts.push(`-${effects.uberschuss} Überschuss`);
        }

        // Stones that were added are now removed
        if (effects.add) {
            effects.add.forEach(effect => {
                const stoneType = STONE_TYPES[effect.type];
                parts.push(`-${effect.count} ${stoneType.name}`);
            });
        }

        // Stones that were replaced are reversed (new type removed, old type restored)
        if (effects.replace) {
            effects.replace.forEach(effect => {
                const toType = STONE_TYPES[effect.to];
                let fromTypeName;
                if (effect.from !== 'ANY' && STONE_TYPES[effect.from]) {
                    fromTypeName = STONE_TYPES[effect.from].name;
                } else if (effect.from === 'ANY') {
                    // Determine default stone type based on tower
                    let defaultType = 'GRID_POWER';
                    if (effect.tower === 'mobility') {
                        defaultType = 'DIESEL';
                    } else if (effect.tower === 'heat') {
                        defaultType = 'GAS';
                    }
                    fromTypeName = STONE_TYPES[defaultType].name;
                } else {
                    fromTypeName = effect.from;
                }
                if (effect.useUberschuss) {
                    parts.push(`-${effect.useUberschuss} ${toType.name} | +${effect.count} ${fromTypeName}`);
                } else {
                    parts.push(`-${effect.count} ${toType.name} | +${effect.count} ${fromTypeName}`);
                }
            });
        }

        // Stones that were reduced are added back
        if (effects.reduce) {
            effects.reduce.forEach(effect => {
                if (effect.count > 0) {
                    const stoneType = effect.type !== 'ANY' && STONE_TYPES[effect.type] ? STONE_TYPES[effect.type].name : effect.type;
                    parts.push(`+${effect.count} ${stoneType} zurück`);
                }
            });
        }
    }

    return parts.length > 0 ? parts.join(' | ') : null;
}

function getTotalUberschuss() {
    let total = 0;
    for (const cardId in gameState.uberschuss) {
        total += gameState.uberschuss[cardId];
    }
    return total;
}

// Helper function to get effective CO2 for GRID_POWER based on active policy cards
function getEffectiveGridPowerCO2() {
    if (gameState.playedCards['75-prozent-erneuerbare']) {
        return 2;
    } else if (gameState.playedCards['kohleausstieg']) {
        return 4;
    }
    return 8;
}

function useUberschuss(amount) {
    let remaining = amount;
    // Use Überschuss from cards that have it available
    for (const cardId in gameState.uberschuss) {
        if (remaining <= 0) break;
        const available = gameState.uberschuss[cardId];
        const toUse = Math.min(available, remaining);
        gameState.uberschuss[cardId] -= toUse;
        remaining -= toUse;
    }
    // Update the header display immediately
    const uberschussElement = document.getElementById('uberschuss');
    if (uberschussElement) {
        uberschussElement.textContent = getTotalUberschuss();
    }
    return amount - remaining; // Return how much was actually used
}

function returnUberschuss(amount) {
    // Return Überschuss to cards that generate it
    // Find cards that have Überschuss capacity (cards with effects.uberschuss)
    let remaining = amount;

    for (const cardId in gameState.playedCards) {
        if (remaining <= 0) break;
        const playedCard = gameState.playedCards[cardId];
        if (playedCard && playedCard.effects && playedCard.effects.uberschuss) {
            // This card generates Überschuss - check if it has capacity
            const maxCapacity = playedCard.effects.uberschuss;
            const currentAmount = gameState.uberschuss[cardId] || 0;
            const availableCapacity = maxCapacity - currentAmount;

            if (availableCapacity > 0) {
                const toReturn = Math.min(availableCapacity, remaining);
                if (!gameState.uberschuss[cardId]) {
                    gameState.uberschuss[cardId] = 0;
                }
                gameState.uberschuss[cardId] += toReturn;
                remaining -= toReturn;
            }
        }
    }

    // Update the header display immediately
    const uberschussElement = document.getElementById('uberschuss');
    if (uberschussElement) {
        uberschussElement.textContent = getTotalUberschuss();
    }

    // After returning Überschuss, try to fulfill unmet needs
    if (amount - remaining > 0) {
        fulfillUnmetUberschuss();
    }

    return amount - remaining; // Return how much was actually returned
}

function deoptimizeWithRemovedUberschuss(removedAmount) {
    if (removedAmount <= 0) return;

    let deoptimized = false;
    let totalConverted = 0;
    const deoptimizedCards = [];
    const remainingUberschuss = getTotalUberschuss();

    // Go through cards currently using Überschuss, starting from most recently optimized
    const cardsUsingUberschuss = Object.keys(gameState.uberschussUsage);

    for (const cardId of cardsUsingUberschuss) {
        const usage = gameState.uberschussUsage[cardId];
        const tower = gameState.towers[usage.tower];
        const targetType = STONE_TYPES[usage.targetType];

        // Calculate how much this card should still be able to use
        const totalNeeded = usage.uberschussUsed;
        const canStillUse = Math.min(totalNeeded, remainingUberschuss);
        const needsToLose = totalNeeded - canStillUse;

        if (needsToLose > 0) {
            // De-optimize this card (1:1 conversion back to grid power)
            const stonesToDeoptimize = needsToLose;

            // Convert clean energy back to grid power
            let converted = 0;
            for (let i = tower.length - 1; i >= 0 && converted < stonesToDeoptimize; i--) {
                if (tower[i].type === usage.targetType) {
                    const oldStone = tower.splice(i, 1)[0];
                    const newStone = createStone('GRID_POWER', oldStone.originCardId);
                    tower.push(newStone);
                    converted++;
                }
            }

            if (converted > 0) {
                // Update usage
                gameState.uberschussUsage[cardId].uberschussUsed = canStillUse;

                // If fully de-optimized, move back to unmet
                if (canStillUse === 0) {
                    delete gameState.uberschussUsage[cardId];
                    gameState.unmetUberschuss[cardId] = {
                        tower: usage.tower,
                        needed: totalNeeded,
                        targetType: usage.targetType,
                        totalStones: usage.totalStones
                    };
                } else if (canStillUse < totalNeeded) {
                    // Partially de-optimized, track unmet portion
                    gameState.unmetUberschuss[cardId] = {
                        tower: usage.tower,
                        needed: totalNeeded - canStillUse,
                        targetType: usage.targetType,
                        totalStones: usage.totalStones
                    };
                }

                const card = gameState.playedCards[cardId];
                log(`  🔄 De-Optimierung: ${converted} ${targetType.name} → Netzstrom für ${card.name} (Überschuss entfernt)`, 'error');
                deoptimized = true;
                totalConverted += converted;
                deoptimizedCards.push(card.name);
            }
        }
    }

    if (deoptimized) {
        renderTowers();
        // Show notification about de-optimization
        showNotification(`🔄 De-Optimierung: ${totalConverted} Steine zurück zu Netzstrom (Überschuss entfernt von: ${deoptimizedCards.join(', ')})`, 'warning', 6000);
        updateCurrentValues();
    }
}

function fulfillUnmetUberschuss() {
    const totalAvailable = getTotalUberschuss();
    if (totalAvailable <= 0) return;

    let optimized = false;
    let totalConverted = 0;
    const optimizedCards = [];

    // Go through all cards with unmet Überschuss needs
    for (const cardId in gameState.unmetUberschuss) {
        const unmet = gameState.unmetUberschuss[cardId];
        const tower = gameState.towers[unmet.tower];
        const neededUberschuss = unmet.needed; // How much Überschuss is still needed
        const targetType = STONE_TYPES[unmet.targetType];

        if (neededUberschuss <= 0) continue;

        const currentAvailable = getTotalUberschuss();
        const uberschussToUse = Math.min(neededUberschuss, currentAvailable);

        if (uberschussToUse > 0) {
            // Convert GRID_POWER stones to clean energy (1:1 conversion)
            let converted = 0;
            for (let i = tower.length - 1; i >= 0 && converted < uberschussToUse; i--) {
                if (tower[i].type === 'GRID_POWER') {
                    const oldStone = tower.splice(i, 1)[0];
                    const newStone = createStone(unmet.targetType, oldStone.originCardId);
                    tower.push(newStone);
                    converted++;
                }
            }

            if (converted > 0) {
                // Use the Überschuss
                useUberschuss(uberschussToUse);
                // Update unmet needs
                gameState.unmetUberschuss[cardId].needed -= uberschussToUse;

                // Track Überschuss usage for this card
                if (!gameState.uberschussUsage[cardId]) {
                    gameState.uberschussUsage[cardId] = {
                        uberschussUsed: 0,
                        tower: unmet.tower,
                        targetType: unmet.targetType,
                        totalStones: unmet.totalStones
                    };
                }
                gameState.uberschussUsage[cardId].uberschussUsed += uberschussToUse;

                const card = gameState.playedCards[cardId];
                log(`  ✨ Optimierung: ${converted} Netzstrom → ${targetType.name} für ${card.name} (${uberschussToUse} Überschuss verwendet)`, 'success');
                optimized = true;
                totalConverted += converted;
                optimizedCards.push(card.name);
            }
        }

        // Clean up if fully met
        if (gameState.unmetUberschuss[cardId].needed <= 0) {
            delete gameState.unmetUberschuss[cardId];
        }
    }

    if (optimized) {
        renderTowers();
        updateCurrentValues();
        // Show notification about auto-optimization
        showNotification(`✨ Auto-Optimierung: ${totalConverted} Netzstrom-Steine durch Überschuss ersetzt (${optimizedCards.join(', ')})`, 'success', 6000);
    }
}

function applyCardEffects(card) {
    const effects = card.effects;

    // Initialize history tracking for this card play
    const history = {
        stonesRemoved: [],  // [{ tower: 'electricity', stones: [{type, ...}] }]
        stonesAdded: [],    // [{ tower: 'electricity', stones: [{type, ...}] }]
        costChange: 0,      // Net cost change
        uberschussAdded: 0, // Amount of uberschuss added by this card
        uberschussUsed: 0,  // Amount of uberschuss consumed by this card
        h2UberschussProduced: 0, // Amount of H₂ Überschuss produced by this card
        h2UberschussUsed: 0,     // Amount of H₂ Überschuss consumed by this card
        faulisChange: 0     // Faulis change (+/-)
    };

    // Special effect: Kohleausstieg - coal phase-out reduces GRID_POWER CO2 from 8t to 4t
    // NOTE: Stones stay on the field unchanged, only the CO2 calculation is affected
    if (effects.replaceAllGridPower) {
        console.log('[KOHLEAUSSTIEG] Aktiviert! Code-Version: 3.0');
        let gridPowerCount = 0;
        const towersToCheck = ['mobility', 'heat', 'electricity'];

        // Count GRID_POWER stones BEFORE (to verify they exist)
        const stoneCountsBefore = {};
        towersToCheck.forEach(towerName => {
            stoneCountsBefore[towerName] = gameState.towers[towerName].length;
        });
        console.log('[KOHLEAUSSTIEG] Steine VORHER:', stoneCountsBefore);

        // DEBUG: Show all stone types in all towers
        towersToCheck.forEach(towerName => {
            const tower = gameState.towers[towerName];
            const stoneTypes = tower.map(s => s.type);
            console.log(`[KOHLEAUSSTIEG] Stein-Typen in ${towerName}:`, stoneTypes);
        });

        // Count GRID_POWER stones (just for logging)
        towersToCheck.forEach(towerName => {
            const tower = gameState.towers[towerName];
            const count = tower.filter(stone => stone.type === 'GRID_POWER').length;
            if (count > 0) {
                log(`  Kohleausstieg: ${count} schwarze Steine in ${towerName} zählen jetzt als 4t statt 8t CO₂`);
            }
            gridPowerCount += count;
        });

        // Count GRID_POWER stones AFTER (to verify nothing changed)
        const stoneCountsAfter = {};
        towersToCheck.forEach(towerName => {
            stoneCountsAfter[towerName] = gameState.towers[towerName].length;
        });
        console.log('[KOHLEAUSSTIEG] Steine NACHHER:', stoneCountsAfter);
        console.log('[KOHLEAUSSTIEG] GRID_POWER Steine gefunden:', gridPowerCount);

        if (gridPowerCount > 0) {
            log(`  Total: ${gridPowerCount} schwarze Steine (CO₂: 8t → 4t)`);
            log(`  CO₂-Reduktion: ${gridPowerCount * 4}t CO₂ eingespart!`);
        } else {
            log(`  Kohleausstieg: Keine schwarzen Steine gefunden`);
        }
    }

    // Special effect: 75% Erneuerbare - reduces GRID_POWER CO2 to 2t
    // NOTE: Stones stay on the field unchanged, only the CO2 calculation is affected
    if (effects.replace75Percent) {
        let gridPowerCount = 0;
        let co2Saved = 0;
        const towersToCheck = ['mobility', 'heat', 'electricity'];
        const kohleausstiegActive = gameState.playedCards['kohleausstieg'] !== undefined;

        // Count GRID_POWER stones (just for logging)
        towersToCheck.forEach(towerName => {
            const tower = gameState.towers[towerName];
            const count = tower.filter(stone => stone.type === 'GRID_POWER').length;
            if (count > 0) {
                log(`  75% Erneuerbare: ${count} schwarze Steine in ${towerName} zählen jetzt als 2t CO₂`);
            }
            gridPowerCount += count;
            // Calculate CO2 saved based on whether Kohleausstieg is active
            co2Saved += count * (kohleausstiegActive ? 2 : 6); // 4t→2t or 8t→2t
        });

        if (gridPowerCount > 0) {
            const fromCO2 = kohleausstiegActive ? '4t' : '8t';
            log(`  Total: ${gridPowerCount} schwarze Steine (CO₂: ${fromCO2} → 2t)`);
            log(`  CO₂-Reduktion: ${co2Saved}t CO₂ eingespart!`);
        } else {
            log(`  75% Erneuerbare: Keine schwarzen Steine gefunden`);
        }
    }

    // Add stones
    if (effects.add) {
        effects.add.forEach(effect => {
            const tower = gameState.towers[effect.tower];
            const stoneType = STONE_TYPES[effect.type];
            const addedStones = [];
            for (let i = 0; i < effect.count; i++) {
                const stone = createStone(effect.type, card.id);
                tower.push(stone);
                addedStones.push({ id: stone.id, type: effect.type });
            }
            // Record added stones for history (with IDs for precise removal)
            history.stonesAdded.push({ tower: effect.tower, stones: addedStones });
            log(`  +${effect.count} ${stoneType.name} Steine → ${effect.tower}`);
        });
    }

    // Replace stones
    let userCancelled = false;
    if (effects.replace) {
        for (const effect of effects.replace) {
            if (userCancelled) break; // Skip remaining effects if user cancelled

            const tower = gameState.towers[effect.tower];
            const fromType = effect.from;
            const toType = STONE_TYPES[effect.to];
            let replaced = 0;
            let cleanEnergyCount = 0;
            let gridPowerCount = 0;

            // Track removed stones for history
            const removedStones = [];
            const addedStones = [];

            // Remove old stones first
            let removed = 0;

            // For type 'ANY', prioritize removing high-CO2 stones first
            if (fromType === 'ANY') {
                const priorityTypes = ['GRID_POWER', 'DIESEL', 'GAS'];
                for (const priorityType of priorityTypes) {
                    for (let i = tower.length - 1; i >= 0 && removed < effect.count; i--) {
                        if (tower[i].type === priorityType) {
                            const removedStone = tower.splice(i, 1)[0];
                            removedStones.push({ id: removedStone.id, type: removedStone.type, originCardId: removedStone.originCardId });
                            removed++;
                        }
                    }
                }
                // If still need more, take any remaining
                for (let i = tower.length - 1; i >= 0 && removed < effect.count; i--) {
                    const removedStone = tower.splice(i, 1)[0];
                    removedStones.push({ id: removedStone.id, type: removedStone.type, originCardId: removedStone.originCardId });
                    removed++;
                }
            } else {
                // Specific type - remove from end
                for (let i = tower.length - 1; i >= 0 && removed < effect.count; i--) {
                    if (tower[i].type === fromType) {
                        const removedStone = tower.splice(i, 1)[0];
                        removedStones.push({ id: removedStone.id, type: removedStone.type, originCardId: removedStone.originCardId });
                        removed++;
                    }
                }
            }

            // Check if we should use Überschuss
            if (effect.useUberschuss) {
                // useUberschuss defines how many NEW stones to add (not a ratio)
                // Remove 'count' stones, add 'useUberschuss' stones
                const stonesToAdd = effect.useUberschuss;
                const totalAvailable = getTotalUberschuss();
                const gridPowerNeeded = stonesToAdd - totalAvailable;

                // If not enough Überschuss, ask user for confirmation
                if (gridPowerNeeded > 0) {
                    const effectiveGridCO2 = getEffectiveGridPowerCO2();
                    const confirmMessage = `⚠️ Nicht genügend Überschuss!\n\n` +
                        `Benötigt: ${stonesToAdd} Überschuss\n` +
                        `Verfügbar: ${totalAvailable} Überschuss\n` +
                        `Fehlend: ${gridPowerNeeded} Steine\n\n` +
                        `Möchten Sie stattdessen ${gridPowerNeeded} Netzstrom-Steine (je ${effectiveGridCO2}t CO₂) zum Stromturm hinzufügen?\n\n` +
                        `Diese können später automatisch durch Überschuss ersetzt werden, wenn mehr verfügbar wird.`;

                    if (!confirm(confirmMessage)) {
                        log(`❌ Karte nicht gespielt: Nicht genügend Überschuss für ${card.name}`, 'error');
                        // Restore removed stones since we're canceling (preserve original IDs)
                        removedStones.forEach(stone => {
                            const stoneType = STONE_TYPES[stone.type];
                            tower.push({
                                id: stone.id !== undefined ? stone.id : ++gameState.stoneIdCounter,
                                type: stone.type,
                                originCardId: stone.originCardId,
                                ...stoneType
                            });
                        });
                        userCancelled = true;
                        continue; // Skip to next iteration (which will break due to flag)
                    }

                    showNotification(`⚡ ${gridPowerNeeded} Netzstrom-Steine hinzugefügt (können später durch Überschuss ersetzt werden)`, 'warning');
                }

                const actuallyUsed = Math.min(stonesToAdd, totalAvailable);

                // Use available Überschuss
                if (actuallyUsed > 0) {
                    useUberschuss(actuallyUsed);
                }

                // Add clean energy stones for Überschuss used
                for (let i = 0; i < actuallyUsed; i++) {
                    const stone = createStone(effect.to, card.id);
                    tower.push(stone);
                    addedStones.push({ id: stone.id, type: effect.to });
                    cleanEnergyCount++;
                }

                // Add grid power stones for remaining (no Überschuss available)
                for (let i = 0; i < gridPowerNeeded; i++) {
                    const stone = createStone('GRID_POWER', card.id);
                    tower.push(stone);
                    addedStones.push({ id: stone.id, type: 'GRID_POWER' });
                    gridPowerCount++;
                }

                // Track uberschuss used in history
                history.uberschussUsed += actuallyUsed;

                // Track Überschuss usage and unmet needs
                const unmetUberschussAmount = stonesToAdd - actuallyUsed;

                if (actuallyUsed > 0) {
                    // Track how much Überschuss this card is using
                    gameState.uberschussUsage[card.id] = {
                        uberschussUsed: actuallyUsed,
                        tower: effect.tower,
                        targetType: effect.to,
                        totalStones: stonesToAdd
                    };
                }

                if (unmetUberschussAmount > 0) {
                    // Track unmet needs for future optimization
                    gameState.unmetUberschuss[card.id] = {
                        tower: effect.tower,
                        needed: unmetUberschussAmount,
                        targetType: effect.to,
                        totalStones: stonesToAdd
                    };
                } else {
                    // Fully met, clear any previous unmet needs
                    delete gameState.unmetUberschuss[card.id];
                }

                replaced = removed;
                log(`  Entfernt: ${removed} ${fromType} Steine`);
                if (cleanEnergyCount > 0) {
                    log(`  Nutze ${actuallyUsed} Überschuss → ${cleanEnergyCount} ${toType.name} Steine (0t CO₂)`);
                }
                if (gridPowerCount > 0) {
                    const effectiveGridCO2 = getEffectiveGridPowerCO2();
                    log(`  Nicht genug Überschuss → ${gridPowerCount} Netzstrom Steine (${effectiveGridCO2}t CO₂) [kann später optimiert werden]`);
                }
            }
            // Check if we should use H₂ Überschuss (for Wasserstoff vehicles - NO grid fallback!)
            else if (effect.useH2Uberschuss) {
                const h2Needed = effect.useH2Uberschuss;
                const h2Available = gameState.h2Uberschuss || 0;
                console.log('[H2-DEBUG] Wasserstoff card needs:', h2Needed, 'H₂ Überschuss, available:', h2Available);

                // H₂ vehicles require H₂ Überschuss - no grid electricity fallback!
                if (h2Available < h2Needed) {
                    const errorMessage = `⚠️ Nicht genügend H₂ Überschuss!\n\n` +
                        `Benötigt: ${h2Needed} H₂ Überschuss\n` +
                        `Verfügbar: ${h2Available} H₂ Überschuss\n\n` +
                        `Wasserstoff-Fahrzeuge benötigen H₂ Überschuss aus der Wasserstofferzeugung.\n` +
                        `Netzstrom kann nicht als Ersatz verwendet werden.`;

                    alert(errorMessage);
                    log(`❌ Karte nicht gespielt: Nicht genügend H₂ Überschuss für ${card.name}`, 'error');

                    // Restore removed stones since we're canceling
                    removedStones.forEach(stone => {
                        const stoneType = STONE_TYPES[stone.type];
                        tower.push({
                            id: stone.id !== undefined ? stone.id : ++gameState.stoneIdCounter,
                            type: stone.type,
                            originCardId: stone.originCardId,
                            ...stoneType
                        });
                    });
                    userCancelled = true;
                    continue;
                }

                // Consume H₂ Überschuss
                gameState.h2Uberschuss -= h2Needed;
                history.h2UberschussUsed = h2Needed;

                // Add HYDROGEN stones for all
                for (let i = 0; i < h2Needed; i++) {
                    const stone = createStone(effect.to, card.id);
                    tower.push(stone);
                    addedStones.push({ id: stone.id, type: effect.to });
                }

                replaced = removed;
                log(`  Entfernt: ${removed} ${fromType} Steine`);
                log(`  Nutze ${h2Needed} H₂ Überschuss → ${h2Needed} ${toType.name} Steine (0t CO₂)`);
                showNotification(`⚡ ${h2Needed} H₂ Überschuss verbraucht`, 'info');
            }
            // Check if we should use Vorrat (stored energy from tower itself)
            else if (effect.useVorrat) {
                // useVorrat means we're using energy already in the system
                // Just do a direct replacement
                for (let i = 0; i < removed; i++) {
                    const stone = createStone(effect.to, card.id);
                    tower.push(stone);
                    addedStones.push({ id: stone.id, type: effect.to });
                }
                replaced = removed;
                log(`  Nutze ${effect.useVorrat} Vorrat → ${replaced} ${toType.name} Steine`);
            }
            // Simple replacement without Überschuss
            else {
                for (let i = 0; i < removed; i++) {
                    const stone = createStone(effect.to, card.id);
                    tower.push(stone);
                    addedStones.push({ id: stone.id, type: effect.to });
                }
                replaced = removed;
                log(`  Ersetzt ${replaced} Steine: ${fromType} → ${toType.name}`);
            }

            // Record history for this replace operation (only if not cancelled)
            if (!userCancelled) {
                if (removedStones.length > 0) {
                    history.stonesRemoved.push({ tower: effect.tower, stones: removedStones });
                }
                if (addedStones.length > 0) {
                    history.stonesAdded.push({ tower: effect.tower, stones: addedStones });
                }
            }
        }

        // If user cancelled, abort the entire card play
        if (userCancelled) {
            return false;
        }
    }

    // Reduce stones
    if (effects.reduce) {
        effects.reduce.forEach(effect => {
            const tower = gameState.towers[effect.tower];
            let removed = 0;
            const removedStones = [];

            // For type 'ANY', prioritize removing high-CO2 stones first (GRID_POWER, GAS, DIESEL)
            // This ensures efficiency cards actually reduce CO2, not just remove renewable stones
            if (effect.type === 'ANY') {
                // Priority order: GRID_POWER, DIESEL, GAS (highest effective CO2 first)
                const priorityTypes = ['GRID_POWER', 'DIESEL', 'GAS'];

                for (const priorityType of priorityTypes) {
                    for (let i = tower.length - 1; i >= 0 && removed < effect.count; i--) {
                        if (tower[i].type === priorityType) {
                            const stone = tower.splice(i, 1)[0];
                            removedStones.push({ id: stone.id, type: stone.type, originCardId: stone.originCardId });
                            removed++;
                            // Calculate effective CO2 for display
                            let effectiveCO2 = stone.co2;
                            if (stone.type === 'GRID_POWER') {
                                effectiveCO2 = getEffectiveGridPowerCO2();
                            } else if (stone.type === 'GAS' && gameState.playedCards['biomethan']) {
                                effectiveCO2 = 3;
                            }
                            log(`  -1 ${stone.name} Stein (${effectiveCO2}t CO₂)`);
                        }
                    }
                }

                // If still need to remove more, take any remaining stones
                for (let i = tower.length - 1; i >= 0 && removed < effect.count; i--) {
                    const stone = tower.splice(i, 1)[0];
                    removedStones.push({ id: stone.id, type: stone.type, originCardId: stone.originCardId });
                    if (stone.type === 'SOLAR' || stone.type === 'WIND' || stone.type === 'HYDROGEN') {
                        // Add to Überschuss on this card
                        if (!gameState.uberschuss[card.id]) {
                            gameState.uberschuss[card.id] = 0;
                        }
                        gameState.uberschuss[card.id]++;
                        history.uberschussAdded++;
                        log(`  1 ${stone.name} Stein → Überschuss`);
                    }
                    removed++;
                }
            } else {
                // Specific type - remove from end as before
                for (let i = tower.length - 1; i >= 0 && removed < effect.count; i--) {
                    if (tower[i].type === effect.type) {
                        const stone = tower.splice(i, 1)[0];
                        removedStones.push({ id: stone.id, type: stone.type, originCardId: stone.originCardId });
                        if (stone.type === 'SOLAR' || stone.type === 'WIND' || stone.type === 'HYDROGEN') {
                            // Add to Überschuss on this card
                            if (!gameState.uberschuss[card.id]) {
                                gameState.uberschuss[card.id] = 0;
                            }
                            gameState.uberschuss[card.id]++;
                            history.uberschussAdded++;
                            log(`  1 ${stone.name} Stein → Überschuss`);
                        }
                        removed++;
                    }
                }
            }

            // Record history for this reduce operation
            if (removedStones.length > 0) {
                history.stonesRemoved.push({ tower: effect.tower, stones: removedStones });
            }

            log(`  -${removed} Steine von ${effect.tower}`);
        });
    }

    // Add Überschuss
    if (effects.uberschuss) {
        if (!gameState.uberschuss[card.id]) {
            gameState.uberschuss[card.id] = 0;
        }
        gameState.uberschuss[card.id] += effects.uberschuss;
        history.uberschussAdded += effects.uberschuss;
        log(`  +${effects.uberschuss} Überschuss-Steine auf ${card.name}`);

        // After adding Überschuss, try to fulfill unmet needs from previously played cards
        fulfillUnmetUberschuss();
    }

    // Add H₂ Überschuss (from Wasserstofferzeugung)
    if (effects.producesH2Uberschuss) {
        console.log('[H2-DEBUG] Before: h2Uberschuss =', gameState.h2Uberschuss);
        gameState.h2Uberschuss = (gameState.h2Uberschuss || 0) + effects.producesH2Uberschuss;
        history.h2UberschussProduced = effects.producesH2Uberschuss;
        console.log('[H2-DEBUG] After: h2Uberschuss =', gameState.h2Uberschuss);
        log(`  +${effects.producesH2Uberschuss} H₂ Überschuss (für Wasserstoff-Fahrzeuge)`);
        showNotification(`⚡ ${effects.producesH2Uberschuss} H₂ Überschuss erzeugt!`, 'success');
    }

    // Modify costs
    if (effects.cost) {
        const costChange = effects.cost;
        history.costChange = costChange;
        if (costChange > 0) {
            // Add cost
            addCostStones(costChange);
        } else {
            // Reduce cost
            removeCostStones(-costChange);
        }
    }

    // Track Faulis change
    if (effects.faulis) {
        history.faulisChange = effects.faulis;
    }

    // Save the history for this card
    gameState.cardPlayHistory[card.id] = history;
    console.log(`[HISTORY] Recorded play history for ${card.name}:`, history);

    renderTowers();
    return true; // Success
}

function addCostStones(amount, showNotification = true) {
    let remaining = amount;

    // Add 100€ stones
    while (remaining >= 100) {
        gameState.costTower.push({ value: 100, type: 'cost-100' });
        remaining -= 100;
    }

    // Add 50€ stones
    while (remaining >= 50) {
        gameState.costTower.push({ value: 50, type: 'cost-50' });
        remaining -= 50;
    }

    log(`  +${amount}€ Kosten`);
}

function removeCostStones(amount, showNotificationFlag = true) {
    let remaining = amount;

    // Remove from tower
    for (let i = gameState.costTower.length - 1; i >= 0 && remaining > 0; i--) {
        const stone = gameState.costTower[i];
        if (stone.value <= remaining) {
            remaining -= stone.value;
            gameState.costTower.splice(i, 1);
        }
    }

    log(`  -${amount}€ Kosten`);
}

function renderTowers() {
    // Base unit for brick width (in pixels per CO2 unit)
    const BASE_WIDTH_UNIT = 8;

    // Check if CO2-reducing cards are active
    const kohleausstiegActive = gameState.playedCards['kohleausstieg'] !== undefined;
    const erneuerbare75Active = gameState.playedCards['75-prozent-erneuerbare'] !== undefined;
    const biomethanActive = gameState.playedCards['biomethan'] !== undefined;

    // Render energy towers
    ['mobility', 'heat', 'electricity'].forEach(sector => {
        const towerElement = document.getElementById(`${sector}-tower`);
        towerElement.innerHTML = '';

        gameState.towers[sector].forEach(stone => {
            const stoneDiv = document.createElement('div');
            stoneDiv.className = `energy-stone ${stone.color}`;

            // Calculate adjusted CO2 and width based on active cards
            let displayCO2 = stone.co2;
            let displayWidth = stone.width || 1;

            if (stone.type === 'GRID_POWER') {
                if (erneuerbare75Active) {
                    displayCO2 = 2;
                    displayWidth = 2;
                } else if (kohleausstiegActive) {
                    displayCO2 = 4;
                    displayWidth = 4;
                }
            } else if (stone.type === 'GAS' && biomethanActive) {
                // Biomethan reduces GAS CO2 from 4t to 3t
                displayCO2 = 3;
                displayWidth = 3;
            }

            stoneDiv.title = `${stone.name} (${displayCO2} t CO₂)`;

            // Set width based on adjusted CO2 emissions
            stoneDiv.style.width = `${displayWidth * BASE_WIDTH_UNIT}px`;

            // Add LEGO studs based on brick width
            const studsContainer = document.createElement('div');
            studsContainer.className = 'studs';

            // Number of studs based on width (1 stud per 2 units, minimum 1)
            const numStuds = Math.max(1, Math.floor(displayWidth / 2));
            for (let i = 0; i < numStuds; i++) {
                const stud = document.createElement('span');
                stud.className = 'lego-stud';
                studsContainer.appendChild(stud);
            }

            stoneDiv.appendChild(studsContainer);
            towerElement.appendChild(stoneDiv);
        });

        // Update count
        document.getElementById(`${sector}-count`).textContent = gameState.towers[sector].length;

        // Update breakdown by stone type
        const breakdown = getStoneBreakdown(gameState.towers[sector]);
        document.getElementById(`${sector}-breakdown`).textContent = breakdown;
    });

    // Render cost display (simple moneybag with number)
    const costTowerElement = document.getElementById('cost-tower');
    const totalCost = gameState.costTower.reduce((sum, stone) => sum + stone.value, 0);

    costTowerElement.innerHTML = `
        <div class="cost-display">
            <span class="cost-icon">💰</span>
            <span class="cost-amount">${totalCost.toLocaleString('de-DE')}€</span>
        </div>
    `;

    // Update total cost in tower-count
    document.getElementById('cost-count').textContent = totalCost.toLocaleString('de-DE');
}

function getStoneBreakdown(tower) {
    // Count stones by type
    const counts = {};
    tower.forEach(stone => {
        counts[stone.type] = (counts[stone.type] || 0) + 1;
    });

    // Build breakdown string with fossil first, then renewables
    const parts = [];

    // Fossil/Grid stones (high CO2)
    const fossilCount = (counts['DIESEL'] || 0) + (counts['GAS'] || 0) + (counts['GRID_POWER'] || 0);
    if (fossilCount > 0) {
        parts.push(`${fossilCount} Fossile`);
    }

    // Solar
    if (counts['SOLAR']) {
        parts.push(`${counts['SOLAR']} Solar`);
    }

    // Wind
    if (counts['WIND']) {
        parts.push(`${counts['WIND']} Wind`);
    }

    // Hydrogen (H₂)
    if (counts['HYDROGEN']) {
        parts.push(`${counts['HYDROGEN']} H₂`);
    }

    return parts.length > 0 ? `(${parts.join(' + ')})` : '';
}

function renderPlayerHand() {
    const unplayedElement = document.getElementById('player-hand-unplayed');
    const playedElement = document.getElementById('player-hand-played');

    if (!unplayedElement || !playedElement) {
        console.error('Player hand elements not found!');
        return;
    }

    unplayedElement.innerHTML = '';
    playedElement.innerHTML = '';

    // Separate cards into unplayed and previously played
    const unplayedCards = [];
    const playedCards = [];

    gameState.playerHand.forEach(card => {
        if (gameState.everPlayedCards.has(card.id)) {
            playedCards.push(card);
        } else {
            unplayedCards.push(card);
        }
    });

    console.log('Rendering player hand:', {
        totalCards: gameState.playerHand.length,
        unplayedCount: unplayedCards.length,
        playedCount: playedCards.length
    });

    // Render unplayed cards
    if (unplayedCards.length === 0) {
        unplayedElement.innerHTML = '<p style="color: #333; padding: 20px; background: #f0f0f0; border: 2px dashed #999; text-align: center;">Keine neuen Karten</p>';
    } else {
        unplayedCards.forEach(card => {
            const cardDiv = createCardElement(card);
            unplayedElement.appendChild(cardDiv);
        });
    }

    // Render previously played cards
    if (playedCards.length === 0) {
        playedElement.innerHTML = '<p style="color: #333; padding: 20px; background: #f0f0f0; border: 2px dashed #999; text-align: center;">Keine bereits gespielten Karten</p>';
    } else {
        playedCards.forEach(card => {
            const cardDiv = createCardElement(card);
            // CSS handles the dashed border styling
            playedElement.appendChild(cardDiv);
        });
    }
}

function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `game-card ${card.sector || ''}`;

    // Display card image if available
    if (card.image) {
        const img = document.createElement('img');
        img.src = card.image;
        img.alt = card.name;
        img.className = 'card-image';
        cardDiv.appendChild(img);
    } else {
        // Fallback to text if no image
        const header = document.createElement('div');
        header.className = 'card-header';
        header.textContent = card.name;

        const body = document.createElement('div');
        body.className = 'card-body';
        body.textContent = card.description || '';

        cardDiv.appendChild(header);
        cardDiv.appendChild(body);
    }

    // Add click handler
    cardDiv.addEventListener('click', () => showCardDetail(card));

    return cardDiv;
}

function showCardDetail(card) {
    const overlay = document.getElementById('card-overlay');
    const detailDiv = document.getElementById('card-detail');

    let html = `<div class="card-detail-layout">`;

    // Large card image
    if (card.image) {
        html += `<div class="card-detail-image"><img src="${card.image}" alt="${card.name}"></div>`;
    }

    html += `<div class="card-detail-info">`;
    html += `<h2>${card.name}</h2>`;
    html += `<p><strong>Sektor:</strong> ${card.sector || 'N/A'}</p>`;
    html += `<p>${card.description || ''}</p>`;

    if (card.effects) {
        html += `<h3>Effekte:</h3><ul>`;
        if (card.effects.add) {
            card.effects.add.forEach(e => {
                html += `<li>+${e.count} ${STONE_TYPES[e.type].name} → ${e.tower}</li>`;
            });
        }
        if (card.effects.replace) {
            card.effects.replace.forEach(e => {
                html += `<li>Ersetzt ${e.count}x ${e.from} durch ${STONE_TYPES[e.to].name}</li>`;
            });
        }
        if (card.effects.reduce) {
            card.effects.reduce.forEach(e => {
                html += `<li>-${e.count} Steine von ${e.tower}</li>`;
            });
        }
        if (card.effects.cost) {
            html += `<li>Kosten: ${card.effects.cost > 0 ? '+' : ''}${card.effects.cost}€</li>`;
        }
        if (card.effects.faulis) {
            html += `<li>Faulis: ${card.effects.faulis > 0 ? '+' : ''}${card.effects.faulis}</li>`;
        }
        html += `</ul>`;
    }

    html += `</div></div>`; // Close card-detail-info and card-detail-layout

    detailDiv.innerHTML = html;

    // Reset button states
    const playButton = document.getElementById('play-card');
    const unplayButton = document.getElementById('unplay-card');

    playButton.style.display = 'inline-block';
    if (unplayButton) {
        unplayButton.style.display = 'none';
    }

    // Set up play button
    playButton.onclick = () => {
        if (playCard(card)) {
            overlay.style.display = 'none';
        }
    };

    overlay.style.display = 'flex';
}

function showPlayedCardDetail(card) {
    const overlay = document.getElementById('card-overlay');
    const detailDiv = document.getElementById('card-detail');

    let html = `<div class="card-detail-layout">`;

    // Large card image
    if (card.image) {
        html += `<div class="card-detail-image"><img src="${card.image}" alt="${card.name}"></div>`;
    }

    html += `<div class="card-detail-info">`;
    html += `<h2>${card.name}</h2>`;
    html += `<p><strong>Status:</strong> Gespielt</p>`;
    html += `<p><strong>Sektor:</strong> ${card.sector || 'N/A'}</p>`;
    html += `<p>${card.description || ''}</p>`;

    if (card.effects) {
        html += `<h3>Effekte:</h3><ul>`;
        if (card.effects.add) {
            card.effects.add.forEach(e => {
                html += `<li>+${e.count} ${STONE_TYPES[e.type].name} → ${e.tower}</li>`;
            });
        }
        if (card.effects.replace) {
            card.effects.replace.forEach(e => {
                html += `<li>Ersetzt ${e.count}x ${e.from} durch ${STONE_TYPES[e.to].name}</li>`;
            });
        }
        if (card.effects.reduce) {
            card.effects.reduce.forEach(e => {
                html += `<li>-${e.count} Steine von ${e.tower}</li>`;
            });
        }
        if (card.effects.cost) {
            html += `<li>Kosten: ${card.effects.cost > 0 ? '+' : ''}${card.effects.cost}€</li>`;
        }
        if (card.effects.faulis) {
            html += `<li>Faulis: ${card.effects.faulis > 0 ? '+' : ''}${card.effects.faulis}</li>`;
        }
        if (card.effects.uberschuss) {
            const uberschuss = gameState.uberschuss[card.id] || 0;
            html += `<li>Überschuss: ${uberschuss} / ${card.effects.uberschuss} Steine verfügbar</li>`;
        }
        html += `</ul>`;
    }

    html += `</div></div>`; // Close card-detail-info and card-detail-layout

    detailDiv.innerHTML = html;

    // Reset button states
    const cardActions = document.getElementById('card-actions');
    const playButton = document.getElementById('play-card');

    // Check if this card can be removed
    // Essential cards cannot be removed: stromnetz, auto, fahrrad
    const isEssentialCard = card.id === 'stromnetz' || card.id === 'auto' || card.id === 'fahrrad';

    if (!isEssentialCard) {
        // Show unplay button
        playButton.style.display = 'none';

        // Hide essential card info if it exists
        const infoDiv = document.getElementById('essential-card-info');
        if (infoDiv) {
            infoDiv.style.display = 'none';
        }

        let unplayButton = document.getElementById('unplay-card');
        if (!unplayButton) {
            unplayButton = document.createElement('button');
            unplayButton.id = 'unplay-card';
            unplayButton.className = 'btn btn-secondary';
            unplayButton.textContent = 'Karte zurücknehmen';
            cardActions.insertBefore(unplayButton, cardActions.firstChild);
        }
        unplayButton.style.display = 'inline-block';
        unplayButton.onclick = () => {
            if (unplayCard(card)) {
                overlay.style.display = 'none';
            }
        };
    } else {
        // For essential cards, hide both buttons and show info message
        playButton.style.display = 'none';
        const unplayButton = document.getElementById('unplay-card');
        if (unplayButton) {
            unplayButton.style.display = 'none';
        }

        // Show info message for why card can't be removed
        let infoDiv = document.getElementById('essential-card-info');
        if (!infoDiv) {
            infoDiv = document.createElement('div');
            infoDiv.id = 'essential-card-info';
            infoDiv.style.cssText = 'padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; margin-top: 10px; color: #856404;';
            cardActions.appendChild(infoDiv);
        }

        if (card.id === 'auto') {
            infoDiv.textContent = 'ℹ️ Diese Karte kann nicht entfernt werden: Jeder Standardhaushalt benötigt ein Auto. Sie können Elektroautos zur Garage hinzufügen.';
        } else if (card.id === 'fahrrad') {
            infoDiv.textContent = 'ℹ️ Diese Karte kann nicht entfernt werden: Jeder Standardhaushalt benötigt ein Fahrrad. Sie können ein E-Bike zum Fahrrad-Feld hinzufügen.';
        } else if (card.id === 'stromnetz') {
            infoDiv.textContent = 'ℹ️ Diese Karte kann nicht entfernt werden: Das Stromnetz ist die Grundversorgung des Haushalts.';
        }
        infoDiv.style.display = 'block';
    }

    cardActions.style.display = 'flex';
    overlay.style.display = 'flex';
}

function unplayCard(card) {
    // Capture CO2 before unplaying for impact display
    const co2Before = calculateTotalCO2();

    // Check if this is a stromnetz card - can only be replaced, not removed
    if (card.field === 'stromnetz') {
        log(`❌ ${card.name} kann nicht entfernt werden: Das Stromnetz ist die Grundversorgung. Sie können es nur durch eine andere Stromnetz-Karte ersetzen.`, 'error');
        alert('Das Stromnetz kann nicht entfernt werden! Es ist die Grundversorgung des Haushalts. Sie können es nur durch eine andere Stromnetz-Karte ersetzen (z.B. Kohleausstieg oder 75% Erneuerbare Energien).');
        return false;
    }

    // Check if this is a heating card and if removing it would leave the heating field empty
    if (isHeatingCard(card) && card.field === 'heizung') {
        const heatingCardsInRoom = gameState.fieldOccupancy['heizung'] ?
            gameState.fieldOccupancy['heizung'].filter(cardId => {
                const c = gameState.playedCards[cardId];
                return c && isHeatingCard(c);
            }).length : 0;

        if (heatingCardsInRoom <= 1) {
            log(`❌ ${card.name} kann nicht entfernt werden: Der Heizungsraum muss immer eine Heizung haben. Bitte zuerst eine andere Heizung installieren.`, 'error');
            alert('Die Heizung kann nicht entfernt werden! Der Heizungsraum muss immer eine Heizung haben. Bitte ersetzen Sie die Heizung durch eine andere (z.B. Wärmepumpe), anstatt sie zu entfernen.');
            return false;
        }
    }

    // Check if this is a meter card and if removing it would leave the heating field without a meter
    if (isMeterCard(card) && card.field === 'heizung') {
        const meterCardsInRoom = gameState.fieldOccupancy['heizung'] ?
            gameState.fieldOccupancy['heizung'].filter(cardId => {
                const c = gameState.playedCards[cardId];
                return c && isMeterCard(c);
            }).length : 0;

        if (meterCardsInRoom <= 1) {
            log(`❌ ${card.name} kann nicht entfernt werden: Der Heizungsraum muss immer einen Stromzähler haben. Bitte zuerst einen anderen Stromzähler installieren.`, 'error');
            alert('Der Stromzähler kann nicht entfernt werden! Der Heizungsraum muss immer einen Stromzähler haben. Bitte ersetzen Sie den Zähler durch einen anderen (z.B. Smart Meter), anstatt ihn zu entfernen.');
            return false;
        }
    }

    // Check for dependent cards (lock/key functionality)
    const dependentCards = findAllDependentCards(card.id);
    if (dependentCards.length > 0) {
        const dependentNames = dependentCards.map(c => c.name).join(', ');
        const confirmMessage = `Achtung! Wenn Sie "${card.name}" entfernen, müssen auch folgende abhängige Karten entfernt werden:\n\n${dependentNames}\n\nDiese Karten benötigen "${card.name}" als Voraussetzung (Schlüssel-Symbol).\n\nMöchten Sie wirklich fortfahren?`;

        if (!confirm(confirmMessage)) {
            log(`Entfernung von ${card.name} abgebrochen (abhängige Karten: ${dependentNames})`, 'info');
            return false;
        }

        // Remove all dependent cards first (in reverse order to handle nested dependencies)
        log(`🔗 Entferne abhängige Karten: ${dependentNames}`, 'info');
        for (const depCard of dependentCards.reverse()) {
            // Skip the dependency check for dependent cards (we already confirmed)
            removeCardWithoutDependencyCheck(depCard);
        }
    }

    log(`Karte wird zurückgenommen: ${card.name}`);

    // Reverse all card effects
    reverseCardEffects(card);

    // Remove card from played cards
    delete gameState.playedCards[card.id];

    // Remove from field occupancy
    if (gameState.fieldOccupancy[card.field]) {
        const index = gameState.fieldOccupancy[card.field].indexOf(card.id);
        if (index > -1) {
            gameState.fieldOccupancy[card.field].splice(index, 1);
        }
    }

    // Remove card from board
    removeCardFromBoard(card);

    // Add card back to player hand (only if not already there)
    const cardAlreadyInHand = gameState.playerHand.some(c => c.id === card.id);
    if (!cardAlreadyInHand) {
        gameState.playerHand.push(card);
    }
    renderPlayerHand();

    log(`✓ ${card.name} zurückgenommen`, 'success');

    // Show notification with summary of what was refunded
    const summary = buildCardEffectSummary(card, 'remove');
    if (summary) {
        showNotification(`↩️ ${card.name} entfernt: ${summary}`, 'info', 5000);
    }

    updateCurrentValues();

    // Update CO2 impact display
    gameState.lastCO2 = co2Before;
    updateCO2Impact('unplay', card.name);

    return true;
}

// Helper function to remove a card without checking dependencies (used when removing dependent cards)
function removeCardWithoutDependencyCheck(card) {
    log(`Abhängige Karte wird entfernt: ${card.name}`);

    // Reverse all card effects
    reverseCardEffects(card);

    // Remove card from played cards
    delete gameState.playedCards[card.id];

    // Remove from field occupancy
    if (gameState.fieldOccupancy[card.field]) {
        const index = gameState.fieldOccupancy[card.field].indexOf(card.id);
        if (index > -1) {
            gameState.fieldOccupancy[card.field].splice(index, 1);
        }
    }

    // Remove card from board
    removeCardFromBoard(card);

    // Add card back to player hand (only if not already there)
    const cardAlreadyInHand = gameState.playerHand.some(c => c.id === card.id);
    if (!cardAlreadyInHand) {
        gameState.playerHand.push(card);
    }
    renderPlayerHand();

    log(`✓ ${card.name} entfernt (war abhängig)`, 'success');

    // Show notification with summary of what was refunded
    const summary = buildCardEffectSummary(card, 'remove');
    if (summary) {
        showNotification(`↩️ ${card.name} entfernt (abhängig): ${summary}`, 'info', 5000);
    }
}

function removeCardFromBoard(card) {
    const fieldSlot = document.querySelector(`.field-slot[data-field="${card.field}"]`);
    if (!fieldSlot) return;

    const cardSlot = fieldSlot.querySelector('.card-slot, .card-slot-multiple');
    if (!cardSlot) return;

    // Find and remove the mini card
    const miniCards = cardSlot.querySelectorAll('.mini-card');
    miniCards.forEach(miniCard => {
        if (miniCard.title === card.name) {
            miniCard.remove();
        }
    });

    // Update field limit displays
    updateFieldLimitDisplays();
}

function updateCurrentValues() {
    const mobilityCount = gameState.towers.mobility.length;
    const heatCount = gameState.towers.heat.length;
    const electricityCount = gameState.towers.electricity.length;
    const totalCount = mobilityCount + heatCount + electricityCount;
    const co2 = calculateTotalCO2();

    // Update simple counts
    document.getElementById('current-mobility').textContent = mobilityCount;
    document.getElementById('current-total').textContent = totalCount;
    document.getElementById('current-co2').textContent = co2;

    // Update detailed breakdown for each tower
    updateTowerBreakdown('mobility', gameState.towers.mobility);
    updateTowerBreakdown('heat', gameState.towers.heat);
    updateTowerBreakdown('electricity', gameState.towers.electricity);

    // Update H₂ (Hydrogen) count
    updateHydrogenDisplay();

    // Update Überschuss display
    updateUberschussDisplay();
}

// Update the hydrogen count display
function updateHydrogenDisplay() {
    // Recalculate H₂ Überschuss from played cards to handle legacy game states
    recalculateH2Uberschuss();

    // Get H₂ Überschuss available (this is what Wasserstoff vehicles need!)
    const h2Uberschuss = gameState.h2Uberschuss || 0;

    console.log('[H2-DEBUG] h2Uberschuss available:', h2Uberschuss);

    // Update the display - show ONLY H₂ Überschuss (this is what matters for playing cards)
    const hydrogenElement = document.getElementById('hydrogen');
    if (hydrogenElement) {
        hydrogenElement.textContent = h2Uberschuss;
    }

    // Show the H₂ counter if there is H₂ Überschuss available
    const h2CountElement = document.getElementById('h2-count');
    if (h2CountElement) {
        h2CountElement.style.display = h2Uberschuss > 0 ? 'block' : 'none';
    }
}

// Recalculate H₂ Überschuss based on played cards
function recalculateH2Uberschuss() {
    let h2Produced = 0;
    let h2Used = 0;

    // Find all cards that produce H₂ Überschuss (currently only Wasserstofferzeugung)
    const allCards = [...STARTER_CARDS, ...GAME_CARDS];
    for (const cardId in gameState.playedCards) {
        const cardDef = allCards.find(c => c.id === cardId);
        if (cardDef && cardDef.effects && cardDef.effects.producesH2Uberschuss) {
            h2Produced += cardDef.effects.producesH2Uberschuss;
        }
        // Find cards that consume H₂ Überschuss
        if (cardDef && cardDef.effects && cardDef.effects.replace) {
            for (const effect of cardDef.effects.replace) {
                if (effect.useH2Uberschuss) {
                    h2Used += effect.useH2Uberschuss;
                }
            }
        }
    }

    const calculatedH2 = Math.max(0, h2Produced - h2Used);

    // Always update - this ensures consistency even after card plays/unplays
    gameState.h2Uberschuss = calculatedH2;
}

// Helper function to get stone breakdown for a tower
function getTowerBreakdown(tower) {
    const breakdown = {};
    const kohleausstiegActive = gameState.playedCards['kohleausstieg'] !== undefined;
    const erneuerbare75Active = gameState.playedCards['75-prozent-erneuerbare'] !== undefined;
    const biomethanActive = gameState.playedCards['biomethan'] !== undefined;

    tower.forEach(stone => {
        if (!breakdown[stone.type]) {
            breakdown[stone.type] = { count: 0, co2: 0 };
        }
        breakdown[stone.type].count++;

        // Calculate effective CO2 based on active cards
        let effectiveCO2 = stone.co2;
        if (stone.type === 'GRID_POWER') {
            if (erneuerbare75Active) {
                effectiveCO2 = 2;
            } else if (kohleausstiegActive) {
                effectiveCO2 = 4;
            }
        } else if (stone.type === 'GAS' && biomethanActive) {
            effectiveCO2 = 3;
        }
        breakdown[stone.type].co2 += effectiveCO2;
    });

    return breakdown;
}

// Helper function to format stone breakdown as string
function formatBreakdown(breakdown) {
    const typeNames = {
        'GRID_POWER': 'Netzstrom',
        'DIESEL': 'Diesel',
        'GAS': 'Gas',
        'SOLAR': 'Solar',
        'WIND': 'Wind',
        'HYDROGEN': 'H₂'
    };

    const parts = [];
    // Order: fossil first, then clean
    const order = ['GRID_POWER', 'DIESEL', 'GAS', 'SOLAR', 'WIND', 'HYDROGEN'];

    for (const type of order) {
        if (breakdown[type] && breakdown[type].count > 0) {
            const name = typeNames[type] || type;
            parts.push(`${breakdown[type].count} ${name}`);
        }
    }

    // Add any other types not in the order list
    for (const type in breakdown) {
        if (!order.includes(type) && breakdown[type].count > 0) {
            const name = typeNames[type] || type;
            parts.push(`${breakdown[type].count} ${name}`);
        }
    }

    return parts.join(' + ');
}

// Update the breakdown display for a specific tower
function updateTowerBreakdown(towerName, tower) {
    const breakdownElement = document.getElementById(`${towerName}-breakdown`);
    if (!breakdownElement) return;

    const breakdown = getTowerBreakdown(tower);
    const totalStones = tower.length;

    if (totalStones === 0) {
        breakdownElement.textContent = '0 Steine';
        return;
    }

    const breakdownStr = formatBreakdown(breakdown);

    // Calculate total CO2 for this tower
    let towerCO2 = 0;
    for (const type in breakdown) {
        towerCO2 += breakdown[type].co2;
    }

    breakdownElement.innerHTML = `${totalStones} Steine (${breakdownStr}) = ${towerCO2}t CO₂`;
}

function updateUberschussDisplay() {
    const totalUberschuss = getTotalUberschuss();

    // Update header display
    const uberschussElement = document.getElementById('uberschuss');
    if (uberschussElement) {
        uberschussElement.textContent = totalUberschuss;
    }

    // Create or update Überschuss info in the log
    const logDetails = [];
    for (const cardId in gameState.uberschuss) {
        const amount = gameState.uberschuss[cardId];
        if (amount > 0) {
            const card = ALL_CARDS.find(c => c.id === cardId);
            if (card) {
                logDetails.push(`${card.name}: ${amount}`);
            }
        }
    }

    if (totalUberschuss > 0) {
        log(`📊 Verfügbarer Überschuss: ${totalUberschuss} Steine (${logDetails.join(', ')})`);
    }
}

function calculateTotalCO2() {
    let total = 0;

    // Check if CO2-reducing cards are active
    const kohleausstiegActive = gameState.playedCards['kohleausstieg'] !== undefined;
    const erneuerbare75Active = gameState.playedCards['75-prozent-erneuerbare'] !== undefined;
    const biomethanActive = gameState.playedCards['biomethan'] !== undefined;

    ['mobility', 'heat', 'electricity'].forEach(sector => {
        gameState.towers[sector].forEach(stone => {
            // Special handling for GRID_POWER stones based on active cards
            if (stone.type === 'GRID_POWER') {
                if (erneuerbare75Active) {
                    // 75% Erneuerbare: GRID_POWER counts as 2t
                    total += 2;
                } else if (kohleausstiegActive) {
                    // Kohleausstieg: GRID_POWER counts as 4t instead of 8t
                    total += 4;
                } else {
                    // Normal: GRID_POWER counts as 8t
                    total += stone.co2;
                }
            } else if (stone.type === 'GAS') {
                // Special handling for GAS stones - Biomethan reduces CO2 from 4t to 3t
                if (biomethanActive) {
                    total += 3;
                } else {
                    total += stone.co2; // Normal: 4t
                }
            } else {
                // All other stone types use their normal CO2 value
                total += stone.co2;
            }
        });
    });

    return total;
}

function checkGoals() {
    const goals = gameState.goals;
    const mobilityCount = gameState.towers.mobility.length;
    const totalCount = mobilityCount + gameState.towers.heat.length + gameState.towers.electricity.length;
    const co2 = calculateTotalCO2();

    const mobilityOk = mobilityCount <= goals.mobility;
    const totalOk = totalCount <= goals.total;
    const co2Ok = co2 <= goals.co2;

    log('=== ZIELÜBERPRÜFUNG ===');
    log(`Mobilitätsturm: ${mobilityCount} / ${goals.mobility} ${mobilityOk ? '✓' : '✗'}`, mobilityOk ? 'success' : 'error');
    log(`Alle Türme: ${totalCount} / ${goals.total} ${totalOk ? '✓' : '✗'}`, totalOk ? 'success' : 'error');
    log(`CO₂: ${co2} / ${goals.co2} ${co2Ok ? '✓' : '✗'}`, co2Ok ? 'success' : 'error');

    if (mobilityOk && totalOk && co2Ok) {
        log(`🎉 Alle Ziele von Runde ${gameState.currentRound} erreicht!`, 'success');
        return true;
    } else {
        log(`Ziele noch nicht erreicht. Weiter spielen!`, 'error');
        return false;
    }
}

function endRound() {
    if (gameState.timer) {
        clearInterval(gameState.timer);
    }

    log(`=== RUNDE ${gameState.currentRound} ENDET ===`);

    const goalsAchieved = checkGoals();

    if (gameState.currentRound === 3) {
        // Game ends
        if (goalsAchieved) {
            log('🎉🎉🎉 SPIEL GEWONNEN! Alle Ziele erreicht! 🎉🎉🎉', 'success');
            alert('Herzlichen Glückwunsch! Ihr habt das Spiel gewonnen! Die Energiewende ist gelungen!');
        } else {
            log('Spiel verloren. Ziele nicht erreicht.', 'error');
            alert('Leider habt ihr die Ziele nicht erreicht. Versucht es noch einmal!');
        }
        document.getElementById('end-round').style.display = 'none';
        document.getElementById('start-game').style.display = 'inline-block';
        document.getElementById('start-game').textContent = 'Neues Spiel';
    } else {
        // In round 1, allow progression even without goal achievement
        if (gameState.currentRound === 1) {
            log('Runde 1 beendet. Weiter zu Runde 2 (Zielerreichung in Runde 1 nicht erforderlich).');
        } else if (!goalsAchieved) {
            log('⚠️ Ziele nicht erreicht, aber Runde wird fortgesetzt.', 'error');
        }

        // Start next round
        setTimeout(() => {
            startRound(gameState.currentRound + 1);
        }, 2000);
    }
}

function showNotification(message, type = 'error', duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.error('Notification container not found!');
        return;
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    // Icon based on type
    const icons = {
        error: '⚠️',
        warning: '⚠️',
        info: 'ℹ️',
        success: '✓'
    };

    // Title based on type
    const titles = {
        error: 'Karte kann nicht gespielt werden',
        warning: 'Warnung',
        info: 'Information',
        success: 'Erfolg'
    };

    notification.innerHTML = `
        <span class="notification-icon">${icons[type] || icons.error}</span>
        <div class="notification-content">
            <div class="notification-title">${titles[type]}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(notification);

    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.add('removing');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

function log(message, type = 'info') {
    const logElement = document.getElementById('game-log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;

    logElement.insertBefore(entry, logElement.firstChild);

    // Keep only last 50 entries
    while (logElement.children.length > 50) {
        logElement.removeChild(logElement.lastChild);
    }

    // Show notification for errors
    if (type === 'error') {
        showNotification(message, 'error');
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initGame);
