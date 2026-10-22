
const API_URL = "/api";

let transactions = [];
let monthlyBudget = 0;
let expenseChart = null;

const form = document.getElementById("transactionForm");
const budgetForm = document.getElementById("budgetForm");
const transactionList = document.getElementById("transactionList");
const dateInput = document.getElementById("date");

dateInput.value = new Date().toLocaleDateString("en-CA");

function money(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(amount);
}

async function loadData() {
    try {
        const response = await fetch(`${API_URL}/transactions`);

        if (!response.ok) {
            throw new Error("Could not load transactions");
        }

        const data = await response.json();
        transactions = data.transactions;
        monthlyBudget = data.budget;

        document.getElementById("monthlyBudget").value =
            monthlyBudget || "";

        renderDashboard();
    } catch (error) {
        console.error(error);
        alert("Unable to load data. Please check the server.");
    }
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const transaction = {
        type: document.getElementById("type").value,
        amount: Number(document.getElementById("amount").value),
        category: document.getElementById("category").value,
        description: document.getElementById("description").value.trim(),
        date: dateInput.value
    };

    if (
        !transaction.description ||
        !Number.isFinite(transaction.amount) ||
        transaction.amount <= 0 ||
        !transaction.date
    ) {
        alert("Please enter valid transaction details.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(transaction)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not add transaction");
        }

        form.reset();
        dateInput.value = new Date().toLocaleDateString("en-CA");

        await loadData();
    } catch (error) {
        alert(error.message);
    }
});

budgetForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const amount = Number(
        document.getElementById("monthlyBudget").value
    );

    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Enter a valid monthly budget.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/budget`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not save budget");
        }

        await loadData();
    } catch (error) {
        alert(error.message);
    }
});

async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) {
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/transactions/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not delete transaction");
        }

        await loadData();
    } catch (error) {
        alert(error.message);
    }
}

function renderDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthTransactions = transactions.filter(item => {
        const date = new Date(item.date + "T12:00:00");

        return (
            date.getMonth() === currentMonth &&
            date.getFullYear() === currentYear
        );
    });

    const income = monthTransactions
        .filter(item => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);

    const expenses = monthTransactions
        .filter(item => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);

    document.getElementById("totalIncome").textContent = money(income);
    document.getElementById("totalExpense").textContent = money(expenses);
    document.getElementById("balance").textContent = money(income - expenses);
    document.getElementById("budgetAmount").textContent = money(monthlyBudget);

    const remaining = monthlyBudget - expenses;
    const status = monthlyBudget
        ? (remaining >= 0
            ? `${money(remaining)} budget remaining`
            : `${money(Math.abs(remaining))} over budget`)
        : "Set your monthly limit";

    document.getElementById("budgetStatus").textContent = status;

    renderTransactions();
    renderChart(monthTransactions);
}

function renderTransactions() {
    transactionList.replaceChildren();

    document.getElementById("emptyMessage").style.display =
        transactions.length ? "none" : "block";

    const sorted = [...transactions].sort((a, b) =>
        b.date.localeCompare(a.date)
    );

    sorted.forEach(item => {
        const row = document.createElement("tr");

        const values = [
            item.date,
            item.type === "income" ? "Income" : "Expense",
            item.category,
            item.description,
            money(item.amount)
        ];

        values.forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value;

            if (index === 4) {
                cell.className =
                    item.type === "income" ? "income-text" : "expense-text";
            }

            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        const button = document.createElement("button");

        button.textContent = "Delete";
        button.className = "delete-btn";
        button.addEventListener("click", () => deleteTransaction(item.id));

        actionCell.appendChild(button);
        row.appendChild(actionCell);
        transactionList.appendChild(row);
    });
}

function renderChart(monthTransactions) {
    const categories = {};

    monthTransactions
        .filter(item => item.type === "expense")
        .forEach(item => {
            categories[item.category] =
                (categories[item.category] || 0) + item.amount;
        });

    const canvas = document.getElementById("expenseChart");

    if (expenseChart) {
        expenseChart.destroy();
    }

    expenseChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories),
                backgroundColor: [
                    "#2563eb", "#10b981", "#f59e0b",
                    "#ef4444", "#8b5cf6", "#06b6d4",
                    "#ec4899", "#64748b"
                ],
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

document.getElementById("exportBtn").addEventListener("click", function () {
    const rows = [
        ["Date", "Type", "Category", "Description", "Amount"],
        ...transactions.map(item => [
            item.date,
            item.type,
            item.category,
            item.description,
            item.amount
        ])
    ];

    const csv = rows.map(row =>
        row.map(value =>
            `"${String(value).replace(/"/g, '""')}"`
        ).join(",")
    ).join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "expense-report.csv";
    link.click();

    URL.revokeObjectURL(url);
});

loadData();
