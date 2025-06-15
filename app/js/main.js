import {Map} from "./map.js"; 
import {RowChart} from "./rowChart.js"; 
import { BarChart } from "./barChart.js";
// import {ScatterPlot} from "./scatterPlot.js"; 
// import {BoxPlot} from "./boxPlot.js";


export class Survey {
    constructor() {
        this.init(); 
    }

    async init() {
        const [responsesData, questionsData] = await Promise.all([
            d3.csv("app/data/responses.csv"),
            d3.csv("app/data/questions.csv")
        ]);
        
        this.responses = responsesData;
        this.responses.forEach(d => {
            d.count = 1;
        })
        dc.facts = crossfilter(this.responses);

        this.demoQuestions = questionsData
            .filter(q => q.question_type === "Demo")
            .map(q => ({
                question_code: q.question_code,
                question_label: q.question_label,
                question: q.question
            }));
        this.questionGroups = this.createQuestionGroups(questionsData) 
        this.createQuestionGroupButtons(this.questionGroups) 

        document.getElementById("clear-filters").addEventListener("click", () => {
            //this.switchQuestion(this.question);
        });

        this.createDemoCharts(this.demoQuestions);

         dc.renderAll();
    }

    // Called in init()
    createQuestionGroups(questionsData) {
        const groupedQuestions = questionsData.filter(q => 
            q.question_type !== "Demo" && 
            q.question_group_name !== "N/A"
        );

        const groupMap = {};
        groupedQuestions.forEach(question => {
            const key = `${question.question_group_name}|${question.question_group_question}`;        
            if (!groupMap[key]) {
                groupMap[key] = {
                    groupName:      question.question_group_name,
                    groupQuestion:  question.question_group_question,
                    questions:      []
                };
            }
            groupMap[key].questions.push({
                question_code: question.question_code,
                question_label: question.question_label,
                question: question.question,
                chartType: question.chart_type,
                dcClass: question.dc_class
            });
        });
        return Object.values(groupMap);
    };

    async switchQuestionGroup(questionGroup) {
        this.questionGroup = questionGroup;
        d3.select("#bar-charts")
            .html("");
        
        d3.select("#bar-charts")
            .append("div")
            .attr("class", "question-group-text")
            .html(questionGroup.groupQuestion);
        
        let config = {
            facts:          dc.facts,      // required
            id:             "bar-chart",   // id of the chart container    
            barWidth:       120,           // px  (optional)
            height:         200,           // px  (optional)
            colors:         ["#83b4db"],   // single or multiple (optional)
            updateFunction: () => {}       // called on filter (optional)
        };

        questionGroup.questions.forEach(q => {
            new BarChart("bar-chart", q.question_code, q.question, config);
        });        
       
        dc.renderAll();
    }

    createDemoCharts(demoQuestions) {        
        const rowCharts = [
           { id: "educ",        name: "Education" },
           { id: "race",        name: "Race" },
           { id: "hispanic",    name: "Hispanic" },
           { id: "votereg",     name: "Voter Registration Status" },
           { id: "pid7",        name: "7 Point Party ID" },

           { id: "CC24_300b_4", name: "Watch CNN"},
           { id: "CC24_300b_5", name: "Watch Fox News" },
           { id: "CC24_300b_6", name: "Watch MSNBC" },
           { id: "CC24_309e",   name: "Gender" },
        ];
        
        const config = {
            facts: dc.facts,
            width: 200,
            updateFunction: this.showSelected
        };

        rowCharts.forEach(chart => {
            new RowChart(chart.id, chart.name, config);
        });
        dc.map = new Map(d3.select("#map"), this.responses, dc.facts.dimension(dc.pluck("inputstate")), this.showSelected);
    }

    // Show current question, filters, and # of responses. Also list the filtered responses
    showSelected = () => {  
        if (!this.responses || !dc.facts) 
            return;
        //this.showFilters();

        dc.map.update();    
        dc.redrawAll();
        //this.writeResponses(dc.facts.allFiltered());
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

    createQuestionGroupButtons(questionGroups) {
        const container = document.getElementById("question-group-buttons");
        container.innerHTML = ""; 
        const highlightButton = (selectedName) => {
            d3.selectAll(".question-group-button")
                .classed("active", function() {
                    return d3.select(this).text() === selectedName;
                });
        };

        questionGroups.forEach(group => {
            const button = document.createElement("button");
            button.textContent = group.groupName;
            button.className = "question-group-button";
            button.addEventListener("click", () => {
                this.switchQuestionGroup(group);
                highlightButton(group.groupName);
            });
            container.appendChild(button);
        });
        this.questionGroup = this.questionGroups[0];
        this.switchQuestionGroup(this.questionGroup);
    };

    setLoading(isLoading) {
        d3.select("#loading-overlay").classed("show", isLoading);
    }
}
