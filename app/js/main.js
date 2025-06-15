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
        this.createDemoCharts(this.demoQuestions);

        this.questionGroups = this.createQuestionGroups(questionsData) 
        this.createQuestionGroupButtons(this.questionGroups) 

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
            barWidth:       80,            // px  (optional)
            height:         200,           // px  (optional)
            colors:         ["#83b4db"],   // single or multiple (optional)
            updateFunction: () => {}       // called on filter (optional)
        };

        questionGroup.questions.forEach(q => {
            new BarChart("bar-chart", q.question_code, q.question, config);
        });        
       
        this.highlightButton(this.questionGroup.groupName); 
        dc.demoCharts.forEach(chart => chart.transitionDuration(0));   
        this.showFilters();
        dc.renderAll();
    }

    createDemoCharts(demoQuestions) {        
        const rowCharts = [
           { id: "educ",        name: "Education" },
           { id: "race",        name: "Race" },
           { id: "hispanic",    name: "Hispanic" },
           { id: "votereg",     name: "Voter Registration Status" },
           { id: "pid7",        name: "7 Point Party ID" },
           { id: "CC24_309e",   name: "General Health"},

           { id: "CC24_300b_4", name: "Watch CNN"},
           { id: "CC24_300b_5", name: "Watch Fox News" },
           { id: "CC24_300b_6", name: "Watch MSNBC" },
           { id: "gender4",     name: "Gender" },
        ];
        
        const config = {
            facts: dc.facts,
            width: 200,
            updateFunction: this.showSelected
        };

        dc.demoCharts = [];
        rowCharts.forEach(chart => {
            dc.demoCharts.push(new RowChart(chart.id, chart.name, config));
        });
        dc.map = new Map(d3.select("#map"), this.responses, dc.facts.dimension(dc.pluck("inputstate")), this.showSelected);
    }

    // Show current question, filters, and # of responses. 
    showSelected = () => {  
        if (!this.responses || !dc.facts) 
            return;
        this.showFilters();

        dc.map.update();    
        dc.redrawAll();
    }

    showFilters() {
        let filters = [];

        const state = dc.states.find(d => d.checked);
        filters.push(`${state ? state.name : "All states"}`);

        dc.chartRegistry.list().forEach(chart => {
            chart.filters().forEach(filter => filters.push(filter));
        });
        
        const responses = dc.facts.allFiltered().length;
        d3.select("#filters")
            .html(`
                <div class="filter-container">
                    <button id="clear-filters" style="float: right;">Clear<br>Filters</button>

                    <div class="active-filters">
                        <span class="filters-label">Filters:</span>
                    <div class="filter-tags">
                        ${filters.map(filter => `<span class="filter-tag">${filter}</span>`).join('')}
                    </div>
                </div>
            </div>
        `);

        const hasFilters = filters.length > 0 && filters.some(f => f !== "All states");
        d3.select("#clear-filters")
            .classed("hidden", !hasFilters)
            .on("click", () => {
            
            dc.filterAll();
            dc.map.clear();

            this.showFilters();
            dc.renderAll();
        });
    }

highlightButton = (selectedName) => {
    console.log("highlightButton called with selectedName:", selectedName);
    
    // Remove active class from all buttons first
    d3.selectAll(".question-group-button").classed("active", false);
    
    // Then add it to matching buttons
    d3.selectAll(".question-group-button")
        .filter(function() {
            const buttonText = d3.select(this).text();
            const isMatch = buttonText === selectedName;
            console.log(`Button text: "${buttonText}", Match: ${isMatch}`);
            return isMatch;
        })
        .classed("active", true);
    
    // Verify the result
    console.log("Buttons with active class:", d3.selectAll(".question-group-button.active").size());
};

    createQuestionGroupButtons(questionGroups) {
        const container = document.getElementById("question-group-buttons");
        container.innerHTML = ""; 

        questionGroups.forEach(group => {
            const button = document.createElement("button");
            button.textContent = group.groupName;
            button.className = "question-group-button";
            button.addEventListener("click", () => {
                this.switchQuestionGroup(group);
                //highlightButton(group.groupName);
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
