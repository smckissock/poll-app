import {Map} from "./map.js"; 
import {RowChart} from "./rowChart.js"; 
import {ScatterPlot} from "./scatterPlot.js"; 
import {BoxPlot} from "./boxPlot.js";


export class Survey {
    constructor() {
        this.init(); 
    }

    async init() {
        const questions = ["q1_rating", "q2_rating", "q3_open", "q4_rating", "q5_open"];
        this.createQuestionButtons(questions);
        this.createOutputButtons(["Charts", "Responses"]);

        document.getElementById("clear-filters").addEventListener("click", () => {
            this.switchQuestion(this.question);
        });

        this.question = questions[0];
        this.switchQuestion(this.question);
    }

    // On start up or when a question button is clicked, get the responses for the question and display them
    async switchQuestion(question) {
        this.question = question;

        const addRowCharts = () => {
            const config = {
                facts: dc.facts,
                width: 200,
                updateFunction: this.showSelected
            };
            const rowCharts = [
                { id: "gender", name: "Gender" },
                { id: "education_level", name: "Education Level" },
                { id: "sentiment_label", name: "Sentiment" },
                { id: "income", name: "Income" },
                { id: "age", name: "Age" },
                { id: "city", name: "City" }
            ];

            rowCharts.forEach(chart => {
                new RowChart(chart.id, chart.name, config);
            });
        }

        const addScatterPlots = () => {
            const config = {
                facts: dc.facts,
                width: 400,
                height: 300,
                updateFunction: this.showSelected.bind(this)
            };
    
            new ScatterPlot("age", this.question, `Age vs ${this.question}`, config);
            new ScatterPlot("income_value", this.question, `Income vs ${this.question}`, config);
            new ScatterPlot("education_level_value", this.question, `Education Level vs ${this.question}`, config);
        };

        const addBoxPlots = () => {     
            const config = {
                facts: dc.facts,
                width: 400,
                updateFunction: this.showSelected.bind(this)
            };
            new BoxPlot("gender", this.question, `Gender vs ${this.question}`, config);
            new BoxPlot("state", this.question, `State vs ${this.question}`, config);
        }        
        
        this.setLoading(true);

        // Clear existing charts and map - important
        dc.chartRegistry.clear();
        d3.selectAll(".dc-chart").html("");
        d3.select("#map").html("");

        try {
            if (!dc.facts) {
                this.responses = await d3.csv("./app/data/us_ai_survey_unique_50.csv");
                dc.facts = crossfilter(this.responses);
            
                this.responses.forEach(d => {
                    d.count = 1;
                    d.income_value = {
                        "Low": 1,
                        "Lower-Middle": 2, 
                        "Upper-Middle": 3,
                        "High": 4
                    }[d.income];
                    d.education_level_value = {
                        "High School": 1,
                        "Some College": 2,
                        "Associate Degree": 3,
                        "Bachelor's Degree": 4,
                        "Master's Degree": 5,
                        "Doctorate": 6
                    }[d.education_level];
                })
            }
                        
            addRowCharts();
            dc.map = new Map(d3.select("#map"), this.responses, dc.facts.dimension(dc.pluck("state")), this.showSelected);

            // No charts for open questions - no numeric answer to plot against
            const openQuestion = this.question.includes("open");
            if (!openQuestion) {
                addScatterPlots();
                addBoxPlots();
                this.switchOutput("Charts");
            } else {
                this.switchOutput("Responses");
            }

            // Charts don"t make sense for open questions
            d3.select("#Charts")
                .style("display", !openQuestion ? "inline-block" : "none");
            
            dc.renderAll();
            dc.filterAll();
            this.showSelected();
            this.setLoading(false)           
        } catch (error) {
            console.error(`Error in SwitchQuestion: ${question}:`, error);
            this.setLoading(false)
            return [];  
        }
    }

    // Show current question, filters, and # of responses. Also list the filtered responses
    showSelected = () => {  
        if (!this.responses || !dc.facts) return;
        this.showFilters();

        dc.map.update();    
        dc.redrawAll();
        this.writeResponses(dc.facts.allFiltered());
    }

    showFilters() {
        let filters = [];

        const state = dc.states.find(d => d.checked);
        filters.push(`${state ? state.name : "All states"}`);

        dc.chartRegistry.list().forEach(chart => {
            chart.filters().forEach(filter => filters.push(filter));
        });

        // Don't show clear filters button if no filters 
        const hasFilters = filters.length > 0 && filters.some(f => f !== "All states");
        const clearButton = document.getElementById("clear-filters");
        clearButton.classList.toggle("hidden", !hasFilters);
        
        const responses = dc.facts.allFiltered().length;
        d3.select("#filters")
            .html(`
                <div class="filter-container">
                    <div class="filter-header">
                        <div class="question-section">
                            <span class="question-label">Question:</span>
                            <span class="question-text">${this.question}</span>
                        </div>
                        <div class="response-count">
                            <span class="count-number">${responses}</span>
                            <span class="count-label">responses</span>
                        </div>
                    </div>
                    <div class="active-filters">
                        <span class="filters-label">Filters:</span>
                    <div class="filter-tags">
                        ${filters.map(filter => `<span class="filter-tag">${filter}</span>`).join('')}
                    </div>
                </div>
            </div>
        `);
    }

    // Write a simple table of the filtered responses    
    writeResponses(responses) {            
        const headers = Object.keys(responses[0])
            .filter(key => key !== "count")
            .sort((a, b) => a === this.question ? 1 : b === this.question ? -1 : 0);

        let html = `<table class="data-table"><thead><tr>`;
        html += headers.map(key => `<th>${key}</th>`).join("");
        html += `</tr></thead><tbody>`;
        html += responses.map(row => {
            return `<tr>` + headers.map(key => `<td>${row[key]}</td>`).join("") + `</tr>`;
        }).join("");

        html += `</tbody></table>`;
        document.getElementById("responses").innerHTML = html
    }

    // Make a button for each question, with a click handler to switch the question
    createQuestionButtons(questionNames) {
        const container = document.getElementById("buttons");
        container.innerHTML = "";
        const highlightButton = (selectedName) => {
            d3.selectAll(".question-button")
                .classed("active", function() {
                    return d3.select(this).text() === selectedName;
                });
        };

        questionNames.forEach(name => {
            const button = document.createElement("button");
            button.textContent = name;
            button.className = "question-button";
            button.addEventListener("click", () => {
                this.switchQuestion(name);
                highlightButton(name);
            });
            container.appendChild(button);
        });
        highlightButton(questionNames[0]);
    }


    // Make a button for each output tab, with a click handler to switch the div
    createOutputButtons(outputNames) {
        const container = document.getElementById("output-buttons");
        container.innerHTML = "";

        const highlightButton = (selectedName) => {
            d3.selectAll(".tab-button")
                .classed("active", function() {
                    return d3.select(this).text() === selectedName;
            });
        };

        outputNames.forEach(name => {
            const button = document.createElement("button");
            button.textContent = name;
            button.className = "tab-button";
            button.id = name;
            button.addEventListener("click", () => {
                this.switchOutput(name);
                highlightButton(name);
            });
            container.appendChild(button);
        });

        // Select first tab on startup
        highlightButton(outputNames[0]);
        this.switchOutput(outputNames[0]);
    }

    switchOutput(output) {
        // Hide all tab content
        document.querySelectorAll("#tab-content > div").forEach(content => {
            content.classList.add("hidden");
        });
    
        // Show the selected tab content
        const targetContent = document.getElementById(output.toLowerCase());
        if (targetContent) 
            targetContent.classList.remove("hidden");
    }

    setLoading(isLoading) {
        d3.select("#loading-overlay").classed("show", isLoading);
    }
}
