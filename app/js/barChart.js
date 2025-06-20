/**
 * @param {Object}  question    – code (column), question and field orders
 * @param {Object}  config      – {
 *       facts          : crossfilter,     // required
 *       barWidth       : 100,             // px (optional)
 *       height         : 250,             // px (optional)
 *       colors         : ["#83b4db"],     // single or multiple (optional)
 *       updateFunction : () => {}         // called on filter (optional)
 *   }
 */
export class BarChart {

    constructor(question, config) {
        const field = question.question_code;
        const title = question.question;
        const fieldValues = question.values;

        this.fieldValues = fieldValues; // Store fieldValues as instance variable
        this.gap = 6; // Gap between bars

        // Create a mapping from label to sort order (since data keys are actually the labels)
        const sortOrderMap = {};
        fieldValues.forEach((item, index) => {
            sortOrderMap[item.label] = String(index).padStart(2, '0'); 
        });

        this.dim = config.facts.dimension(dc.pluck(field));

        // Count responses by category
        const rawGroup = this.dim.group().reduceCount();
        const percentGroup = {
            all: () => {
                const data = rawGroup.all().filter(d => d.key !== "");
                const total = d3.sum(data, d => d.value);

                return data.map(d => {
                    // Prepend sort order to key for proper sorting
                    const sortOrder = sortOrderMap[d.key] || ' '; // Default high value for unknown keys
                    return {
                        key: `${sortOrder}_${d.key}`,
                        originalKey: d.key,
                        value: total ? (d.value / total * 100) : 0
                    };
                });
            }
        };
        this.group = percentGroup;

        // Get the display labels from fieldValues
        const labelMap = {};
        fieldValues.forEach(item => {
            labelMap[item.key] = item.label;
        });

        // Temporary hack to set bar width from longest label. Need to wrap the label or ?
        const maxNameLength = this.dim.group().all()
            .reduce((max, d) => Math.max(max, d.key.toString().length), 0);
        config.barWidth = ((maxNameLength - 4) * 2) + 64;

        const categoryCount = rawGroup.all().length;
        const chartWidth = (config.barWidth ?? 120) * categoryCount;

        const wrapperDiv = d3.select("#bar-charts")
            .append("div")
            .attr("class", "chart-wrapper")
            .style("display", "inline-block")
            .style("width", `${chartWidth}px`)    
            .style("vertical-align", "top");

        wrapperDiv
            .append("div")
            .attr("id", field);

        const chart = dc.barChart("#" + field)
            .width(chartWidth)
            .height(config.height ?? 250)
            .margins({ top: 20, right: 30, bottom: 25, left: 40 })
            .dimension(this.dim)
            .group(this.group)
            .x(d3.scaleBand())
            .xUnits(dc.units.ordinal)
            .gap(this.gap)
            .elasticY(false)
            .y(d3.scaleLinear().domain([0, 100]))
            .ordinalColors(config.colors ?? ["#83b4db"])
            .renderLabel(false)
            .title(d => `${d.originalKey || d.key.split('_')[1]}: ${d.value.toFixed(0)}%`)
            .on("filtered", () => {
                if (config.updateFunction)
                    config.updateFunction();
            })
            .transitionDuration(0)
            .on("postRender", c => {
                c.transitionDuration(750);  
                // Remove click event to prevent filtering on bar click                
                this.chart.selectAll("rect.bar").on("click", null);              
                this.positionLabelsAboveXAxis(c);
                this.updateXAxisLabels(c);
                this.addNationalLines(c);
            })
            .on("postRedraw", c => {                
                this.positionLabelsAboveXAxis(c);
                this.updateXAxisLabels(c);
                this.addNationalLines(c);
            });

        chart.yAxis()
            .ticks(4)
            .tickFormat(d => `${d.toFixed(0)}%`);

        wrapperDiv
            .append("div")
            .attr("id", `${field}-title`)
            .attr("class", "question-text")
            .style("width", "100%")
            .style("word-wrap", "break-word")
            .style("white-space", "normal")
            .text(title);

        this.chart = chart;
    }

    updateXAxisLabels(chart) {
        // Update x-axis labels to show original labels instead of prefixed keys
        const svg = d3.select(`#${chart.anchorName()}`).select("svg");
        svg.selectAll(".x.axis .tick text")
            .text(function(d) {
                // Extract original key from the prefixed key
                return d.split('_')[1];
            });
    }

    positionLabelsAboveXAxis(chart) {
        // Get the chart's SVG and scales
        const svg = d3.select(`#${chart.anchorName()}`).select("svg");
        const yScale = chart.y();
        const xScale = chart.x();
        const margins = chart.margins();
        
        // Calculate position just above x-axis
        const xAxisY = yScale(0) + margins.top;
        const labelOffset = 8; // pixels above x-axis
        const labelY = xAxisY - labelOffset - 2;

        // Remove any existing custom labels first
        svg.selectAll("text.custom-bar-label").remove();

        // Create new labels positioned above x-axis
        const data = chart.group().all();
        svg.selectAll("text.custom-bar-label")
            .data(data)
            .enter()
            .append("text")
            .attr("class", "custom-bar-label")
            .attr("y", labelY)
            .attr("x", d => {
                // Center label horizontally on the bar, accounting for margins
                const bandWidth = xScale.bandwidth();
                return xScale(d.key) + bandWidth / 2 + margins.left;
            })
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .style("fill", "#333")
            .text(d => `${d.value.toFixed(0)}%`);
    }

    addNationalLines(chart) {
        // Get the chart's SVG and scales
        const svg = d3.select(`#${chart.anchorName()}`).select("svg");
        const yScale = chart.y();
        const xScale = chart.x();
        const margins = chart.margins();

        // Get the data for updating/entering/exiting
        const data = chart.group().all();
        
        if (this.fieldValues) {
            // Bind data to reference bars
            const referenceBars = svg.selectAll("line.reference-bar")
                .data(data);

            // Remove old bars with transition
            referenceBars.exit()
                .transition()
                .duration(250)
                .style("opacity", 0)
                .remove();

            // Add new bars in their final position, just invisible
            const enterBars = referenceBars.enter()
                .append("line")
                .attr("class", "reference-bar")
                .attr("x1", d => {
                    const bandWidth = xScale.bandwidth();
                    return xScale(d.key) + margins.left + (this.gap / 2);
                })
                .attr("x2", d => {
                    const bandWidth = xScale.bandwidth();
                    return xScale(d.key) + bandWidth + margins.left - (this.gap / 2) + 2;
                })
                .attr("y1", d => {
                    const originalKey = d.originalKey || d.key.split('_')[1];
                    const fieldValue = this.fieldValues.find(fv => fv.label === originalKey);
                    const percentage = fieldValue ? fieldValue.percentage : 0;
                    return yScale(percentage) + margins.top;
                })
                .attr("y2", d => {
                    const originalKey = d.originalKey || d.key.split('_')[1];
                    const fieldValue = this.fieldValues.find(fv => fv.label === originalKey);
                    const percentage = fieldValue ? fieldValue.percentage : 0;
                    return yScale(percentage) + margins.top;
                })
                .style("stroke", "red")
                .style("stroke-width", 3)
                .style("opacity", 0); // Start invisible

            // Fade in new bars
            enterBars
                .transition()
                .duration(250)
                .style("opacity", 0.8);

            // Update existing bars with position transitions
            referenceBars
                .transition()
                .duration(200)
                .attr("x1", d => {
                    const bandWidth = xScale.bandwidth();
                    return xScale(d.key) + margins.left + (this.gap / 2);
                })
                .attr("x2", d => {
                    const bandWidth = xScale.bandwidth();
                    return xScale(d.key) + bandWidth + margins.left - (this.gap / 2) + 2; // Adjust for gap
                })
                .attr("y1", d => {
                    const originalKey = d.originalKey || d.key.split('_')[1];
                    const fieldValue = this.fieldValues.find(fv => fv.label === originalKey);
                    const percentage = fieldValue ? fieldValue.percentage : 0;
                    return yScale(percentage) + margins.top;
                })
                .attr("y2", d => {
                    const originalKey = d.originalKey || d.key.split('_')[1];
                    const fieldValue = this.fieldValues.find(fv => fv.label === originalKey);
                    const percentage = fieldValue ? fieldValue.percentage : 0;
                    return yScale(percentage) + margins.top;
                });
        }
    }
}