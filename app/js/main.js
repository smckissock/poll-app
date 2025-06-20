import { tableFromIPC } from "https://cdn.jsdelivr.net/npm/apache-arrow@14.0.2/+esm";

import {Map} from "./map.js"; 
import {RowChart} from "./rowChart.js"; 
import { BarChart } from "./barChart.js";


export class Survey {

    constructor() {
        this.currentBarCharts = []; // Sowe can dispose  of them whe questuion group changes
        this.init(); 
    }

    async init() {
        const loading = (isLoading) => d3.select("#loading-overlay").classed("show", isLoading);

        loading(true);
        const [responsesData, questionsData] = await Promise.all([
            this.loadArrowData("app/data/responses.arrow"),
            d3.csv("app/data/questions.csv")
        ]);
        loading(false);
        
        this.responses = responsesData;
        this.responses.forEach(d => {
            d.count = 1;
            // Replace nulls with empty strings for all fields - nulls break dimensions
            Object.keys(d).forEach(key => {
                if (d[key] === null || d[key] === undefined) 
                    d[key] = "";
            });
        })
        dc.facts = crossfilter(this.responses);
        
        this.createDemoCharts(this.demoQuestions);

        this.initializeClearFiltersButton();

        this.questionList = this.makeQuestionList(questionsData);
        this.addQuestionPercentages(this.questionList, this.responses) 

        this.questionGroups = this.createQuestionGroups(this.questionList) 
        this.createQuestionGroupButtons(this.questionGroups) 

        dc.renderAll();
    }

    async loadArrowData(path) {
        const response = await fetch(path);
        const buffer = await response.arrayBuffer();        
        const table = tableFromIPC(buffer);
        
        const rows = [];
        for (let i = 0; i < table.numRows; i++) {
            const row = {};        
            for (let j = 0; j < table.numCols; j++) {
                const field = table.schema.fields[j];
                const column = table.getChildAt(j);
                row[field.name] = column.get(i);
            }
            rows.push(row);
        }
        return rows;
    }

    // Return list on non-demo questions with percentages for each response
    makeQuestionList(questions) {        
        const parseValues = (raw) => {  
            const parsed = JSON.parse(raw.replace(/'/g, '"'));
            return Object.entries(parsed).map(([key, label]) => ({
                key,
                label
            }));
        };

        let questionList = questions
            .filter(q => 
                q.question_type !== "Demo" && 
                q.question_group_name !== "N/A"
            );

        questionList.forEach(q => q.values = parseValues(q.values));
        return questionList;    
    }

    addQuestionPercentages(questions, responses) {
        questions.forEach(question => {
            const code = question.question_code;
            const validLabels = new Set(question.values.map(v => v.label));

            // Count frequency of each value for the question (only valid ones)
            const counts = {};
            let validResponseCount = 0;        
            responses.forEach(resp => {
                const answer = resp[code];
                if (validLabels.has(answer)) {
                    if (answer in counts) 
                        counts[answer]++;
                    else 
                        counts[answer] = 1;
                    validResponseCount++;
                }
            });

            // Assign percentage to each value in question.values
            question.values.forEach(v => {
                const count = counts[v.label] || 0;
                v.percentage = validResponseCount > 0 ? 
                    +(100 * count / validResponseCount).toFixed(1) : 0;
            });
        });
    }

    // Only called in init()
    createQuestionGroups(questionList) {    
        const groupMap = {};
        questionList.forEach(question => {    
            const key = `${question.question_group_name}|${question.question_group_question}`;        
            if (!groupMap[key]) {
                groupMap[key] = {
                    groupName:      question.question_group_name,
                    groupQuestion:  question.question_group_question,
                    questions:      []
                };
            }
            groupMap[key].questions.push({
                question_code:  question.question_code,
                question_label: question.question_label,
                question:       question.question,
                chartType:      question.chart_type,
                dcClass:        question.dc_class,
                values:         question.values
            });
        });
        return Object.values(groupMap);
    };
    
    async switchQuestionGroup(questionGroup) {
        // Clean up existing bar charts and their dimensions
        if (this.currentBarCharts) {
            this.currentBarCharts.forEach(chartInstance => {
                if (chartInstance.chart) {
                    chartInstance.chart.filterAll();
                    dc.deregisterChart(chartInstance.chart);
                }
                if (chartInstance.dim) {
                    chartInstance.dim.dispose();
                }
            });
        }
        
        this.questionGroup = questionGroup;
        this.currentBarCharts = [];
        d3.select("#bar-charts")
            .html("");

        d3.select("#bar-charts")
            .append("div")
            .attr("class", "question-group-name")
            .html(questionGroup.groupName);
        
        d3.select("#bar-charts")
            .append("div")
            .attr("class", "question-group-text")
            .html(questionGroup.groupQuestion);
        
        let config = {
            facts:          dc.facts,      // required
            id:             "bar-chart",   // id of the chart container    
            barWidth:       80,            // px  (optional)
            height:         180,           // px  (optional)
            colors:         ["#83b4db"],   // single or multiple (optional)
            updateFunction: () => {}       // called on filter (optional)
        };

        questionGroup.questions.forEach(q => {
            const chartInstance = this.renderChart(q, config);
            if (chartInstance) {
                this.currentBarCharts.push(chartInstance);
            }
        });        
    
        this.highlightButton(this.questionGroup.groupName); 
        dc.demoCharts.forEach(chart => chart.transitionDuration(0));   
        this.showFilters();
        dc.renderAll();
    }
    
    renderChart(q, config) {
        let chartInstance;
        switch (q.chartType) {
            case "stackedBinary":
            case "stackedLikert5":
            case "stackedLikert7":
                chartInstance = new BarChart(q, config);
                break;
            case "row3Cat":
            case "rowMultiCat":
            case "TBD":
                chartInstance = new BarChart(q, config);
                break;
            default:
                console.warn(`Unknown chart type for ${q.question_code}: ${q.chartType}`);
        }
        return chartInstance;
    }

    createDemoCharts(demoQuestions) {        
        const rowCharts = [
           { id: "educ",        name: "Education" },
           { id: "race",        name: "Race" },
           { id: "hispanic",    name: "Hispanic" },
           { id: "votereg",     name: "Voter Registration Status" },
           { id: "pid7",        name: "7 Point Party ID" },
           { id: "CC24_309e",   name: "General Health"},
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

    showSelected = () => {  
        if (!this.responses || !dc.facts) 
            return;
        this.showFilters();
        dc.map.update();    
        dc.redrawAll();
    }

    getFilterString() {
        let filters = [];
        const state = dc.states.find(d => d.checked);
        filters.push(`${state ? state.name : "Nationwide"}`);
        dc.chartRegistry.list().forEach(chart => {
            chart.filters().forEach(filter => filters.push(filter));
        });
        return filters;
    }

    showFilters() {
        let filters = this.getFilterString();
        const responses = dc.facts.allFiltered().length;
        const hasFilters = filters.length > 0 && filters.some(f => f !== "Nationwide");

        d3.select(".responses-count")
            .text(`Responses: ${responses.toLocaleString()}`);
        
        d3.select(".filter-tags")
            .html(filters.map(filter => `<span class="filter-tag">${filter}</span>`).join(''));
        
        // Show/hide the clear button based on whether there are filters
        d3.select("#clear-filters")
            .classed("hidden", !hasFilters);
    }

    // Add this method to your Survey class to initialize the clear filters button
    initializeClearFiltersButton() {
        console.log("Attaching clear filters button handler", d3.select("#clear-filters").node());
        d3.select("#clear-filters")
            .on("click", (event) => {
                console.log("Before preventDefault");

                event.preventDefault();
                event.stopPropagation();
                
                console.log("Clearing filters");
                dc.filterAll();
                dc.map.clear(); 
                // Remove this.showFilters() since dc.renderAll() will trigger showSelected()
                dc.renderAll();
            });
    }

    highlightButton = (selectedName) => {
        d3.selectAll(".question-group-button")
            .classed("active", function() {
                return d3.select(this).text() === selectedName;
        });
    };

    createQuestionGroupButtons(questionGroups) {
        const container = d3.select("#question-group-buttons");
        container.selectAll("*").remove();

        const buttons = container.selectAll(".question-group-button")
            .data(questionGroups)
            .enter()
            .append("button")
            .attr("class", "question-group-button")
            .text(d => d.groupName)
            .on("click", (event, d) => {
            this.switchQuestionGroup(d);
        });

        this.questionGroup = this.questionGroups[0];
        this.switchQuestionGroup(this.questionGroup);
    };
}