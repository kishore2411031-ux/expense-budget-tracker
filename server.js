
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

const dataFolder = path.join(__dirname, "data");
const transactionsFile = path.join(dataFolder, "transactions.json");
const budgetsFile = path.join(dataFolder, "budgets.json");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function ensureFile(file, initialData) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(initialData, null, 2));
    }
}

fs.mkdirSync(dataFolder, { recursive: true });
ensureFile(transactionsFile, []);
ensureFile(budgetsFile, { amount: 0 });

function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.get("/api", (req, res) => {
    res.json({ message: "Expense and Budget Tracker API is running!" });
});

app.get("/api/transactions", (req, res) => {
    try {
        const transactions = readJSON(transactionsFile);
        const budgetData = readJSON(budgetsFile);

        res.json({
            transactions,
            budget: budgetData.amount || 0
        });
    } catch (error) {
        res.status(500).json({ message: "Unable to read financial data." });
    }
});

app.post("/api/transactions", (req, res) => {
    try {
        const { type, amount, category, description, date } = req.body;

        if (
            !["income", "expense"].includes(type) ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            typeof category !== "string" ||
            !category.trim() ||
            typeof description !== "string" ||
            !description.trim() ||
            typeof date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            Number.isNaN(Date.parse(date + "T12:00:00Z"))
        ) {
            return res.status(400).json({
                message: "Please provide valid transaction details."
            });
        }

        const transactions = readJSON(transactionsFile);

        const transaction = {
            id: crypto.randomUUID(),
            type,
            amount,
            category: category.trim(),
            description: description.trim(),
            date
        };

        transactions.push(transaction);
        writeJSON(transactionsFile, transactions);

        res.status(201).json({
            message: "Transaction added successfully.",
            transaction
        });
    } catch (error) {
        res.status(500).json({ message: "Unable to save transaction." });
    }
});

app.delete("/api/transactions/:id", (req, res) => {
    try {
        const transactions = readJSON(transactionsFile);
        const updated = transactions.filter(
            item => item.id !== req.params.id
        );

        if (updated.length === transactions.length) {
            return res.status(404).json({
                message: "Transaction not found."
            });
        }

        writeJSON(transactionsFile, updated);

        res.json({ message: "Transaction deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "Unable to delete transaction." });
    }
});

app.put("/api/budget", (req, res) => {
    try {
        const { amount } = req.body;

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                message: "Please enter a valid budget amount."
            });
        }

        writeJSON(budgetsFile, { amount });

        res.json({
            message: "Monthly budget saved successfully.",
            amount
        });
    } catch (error) {
        res.status(500).json({ message: "Unable to save budget." });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
