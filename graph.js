

function plotTimelineData(svg, timelineData, dataId, yAxisName, area) {

    var x = d3.scale.linear().range([0, area.width]);
    var y = d3.scale.linear().range([area.height, 0]);

    var color = d3.scale.category10();

    var xAxis = d3.svg.axis().scale(x).orient("bottom");
    var yAxis = d3.svg.axis().scale(y).orient("left");

    var line = d3.svg.line()
        .interpolate("cardinal")
        .x(function (d) {
            return x(d.time);
        })
        .y(function (d) {
            return y(d[dataId]);
        });


    color.domain(timelineData.map(function (summoner) {
        return summoner.name;
    }));


    var maxTime = d3.max(timelineData, function (summoner) {
        return summoner.maxValues.time;
    });

    x.domain([0, maxTime]);

    var valMin = 0;
    var valMax = 0;
    timelineData.forEach(function (summoner) {
        valMax = Math.max(valMax, summoner.maxValues[dataId]);
        valMin = Math.min(valMin, summoner.minValues[dataId]);
    });

    y.domain([
        valMin,
        valMax + (valMax - valMin)* 0.05
    ]);


    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + area.height + ")")
        .call(xAxis);


    var xAxisGrid = d3.svg.axis().scale(x)
        .ticks(maxTime)
        .tickSize(-area.height, 0)
        .tickFormat("")
        .orient("top");

    var yAxisGrid = d3.svg.axis().scale(y)
        //.ticks(valMax / 1000)
        .tickSize(-area.width, 0)
        .tickFormat("")
        .orient("left");

    svg.append("g")
        .classed("x", true)
        .classed("axis", true)
        .call(xAxisGrid);

    svg.append("g")
        .classed("y", true)
        .classed("axis", true)
        .call(yAxisGrid);

    var summoner = svg.selectAll(".summoner")
        .data(timelineData)
        .enter().append("g")
        .attr("class", "summoner");


    var bisector = d3.bisector(function(v) { return v.time;}).left;

    function mouseOverCircle(circle) {
        var d = circle.parentNode.__data__;
        var x0 = x.invert(d3.mouse(circle)[0]);
        var i = bisector(d.values, x0, 1);
        var d0 = d.values[i - 1];
        var d1 = d.values[i];
        var d;
        if (!d1 || !d0) {
            d = d0 || d1;
        }
        else {
            d = x0 - d0.time > d1.time - x0 ? d1 : d0;
        }

        focus.select("text.mouseover")
            .attr("transform",
            "translate(" + x(d.time) + "," +
            y(d[dataId]) + ")")
            .text(d[dataId]);
    }

    var focus = svg.append("g")
        .style("display", "none");

    focus.append("text")
        .attr("class", "mouseover")
        .style("stroke", "black")
        .style("opacity", 0.8)
        .attr("text-anchor", "middle")
        .attr("dy", "-0.8em");




    summoner.append("path")
        .attr("id", "path")
        .attr("class", "line")
        .attr("d", function (d) {
            return line(d.values);
        })
        .style("stroke", function (d) {
            return color(d.name);
        })
        //.on("mouseover", function(d) {
        //    svg.selectAll("path.line").sort(function (a, b){
        //        if (a.id != d.id) return -1;
        //        else return 1;
        //    });
        //})
    ;


    var point = summoner.append("g")
        .attr("class", "graph-point");


    point.selectAll("circle")
        .data(function(d) {return d.values; })
        .enter().append("circle")
        .attr("class", "data-circle")
        .attr("cx", function(d) { return x(d.time); } )
        .attr("cy", function(d) { return y(d[dataId]);} )
        .attr("r", 4.5)
        .style("fill", function (d){
            if (this.parentNode.__data__.team) {
                return "purple";
            }
            else {
                return "red";
            }
        })
        .style("stroke", function (d) {
            return color(this.parentNode.__data__.name);
        })
        .on("mouseover", function(d) {
            focus.style("display", null);
        })
        .on("mouseout", function() { focus.style("display", "none"); })
        .on("mousemove", function(d) {
            mouseOverCircle(this);
        });

    svg.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .append("text")
        .attr("class", "text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text(yAxisName);


    summoner.append("text")
        .datum(function (d) {
            return {name: d.name, value: d.values[d.values.length - 1]};
        })
        .attr("transform", function (d) {
            return "translate(" + x(d.value.time) + "," + y(d.value[dataId]) + ")";
        })
        .attr("x", 3)
        .attr("dy", ".35em")
        .text(function (d) {
            return d.name;
        });
}

var timelineDataKeys = [
    "xp",
    "xpPerMin",
    "totalGold",
    "goldPerMin",
    "minionsKilled",
    "monstersKilled",
    "currentGold",
    "posX",
    "posY",
    "level",
    "time"
];

function getTimelineData(data) {
    var participantsById = {};

    data.participantIdentities.forEach(function (participant) {
        participantsById[participant.participantId] = participant;
    });

    var timelineFrames = data.timeline.frames;

    var summonerData = d3.keys(participantsById).map(function (participantId) {
        var lastGold = 0;
        var lastTimestamp = 0;
        var lastXp = 0;

        var maxValues = {}
        var minValues = {}

        var lastPos = {x: 0, y: 0};

        timelineDataKeys.forEach(function (key) {
            maxValues[key] = Number.NEGATIVE_INFINITY;
            minValues[key] = Number.POSITIVE_INFINITY;
        });

        return {
            name: participantsById[participantId].player.summonerName,
            id: participantId,
            team: (participantId <= 5) ? 0 : 1,
            values: timelineFrames.map(function (frame) {
                var pFrame = frame.participantFrames[participantId];
                if (lastGold == 0) lastGold = pFrame.totalGold;

                var timeDiff = frame.timestamp - lastTimestamp;
                if (!pFrame.position) pFrame.position = lastPos;
                var d = {
                    xp: pFrame.xp,
                    xpPerMin: timeDiff > 0 ? (pFrame.xp - lastXp) : 0,
                    totalGold: pFrame.totalGold,
                    goldPerMin: timeDiff > 0 ? (pFrame.totalGold - lastGold) : 0,
                    minionsKilled: pFrame.minionsKilled,
                    monstersKilled: pFrame.jungleMinionsKilled,
                    currentGold: pFrame.currentGold,
                    posX: pFrame.position.x,
                    posY: pFrame.position.y,
                    level: pFrame.level,
                    time: frame.timestamp / 60000
                }

                timelineDataKeys.forEach(function (key) {
                    maxValues[key] = Math.max(maxValues[key], d[key]);
                    minValues[key] = Math.min(minValues[key], d[key]);
                });

                lastPos = pFrame.position;

                lastGold = pFrame.totalGold;
                lastXp = pFrame.xp;
                lastTimestamp = frame.timestamp;
                return d;
            }),
            maxValues: maxValues,
            minValues: minValues
        }
    });


    return summonerData;
}
