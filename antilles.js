// SVG utilities
var set = function (obj, attr, val) {obj.setAttributeNS(null, attr, val)}
var elem = function (tag, attrs) {
    var result = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var attr in attrs) {set(result, attr, attrs[attr])}
    return result
}
var rect = function (x, y, w, h) {
    return elem("rect", {x: x, y: y, width: w, height: h, fill: "none", class: "created"})
}
var line = function (a, b) {
    return elem("line", {x1: a[0], x2: b[0], y1: a[1], y2: b[1], class: "created thick"})
}
var outline = elem => {
    var padding = 10
    var box = elem.getBBox()
    return rect(
        box.x - padding,         box.y - padding,
        box.width + 2 * padding, box.height + 2 * padding)
}

// DOM manipulation utilities
var highlightElement = elem => elem.classList += " highlighted"

var getLargestQuadrant = function (country, maxWidth, maxHeight) {
    var width = {left: country.x, right: maxWidth - country.x - country.width}
    var height = {top: topHeight = country.y, bottom: maxHeight - country.y - country.height}
    return [
        rect(0, 0, width.left, maxHeight),                              // left
        rect(0, 0, maxWidth, height.top),                               // top
        rect(country.x + country.width, 0, width.right, maxHeight),     // right
        rect(0, country.y + country.height, maxWidth, height.bottom)    // bottom
    ].reduce(function (acc, rect) {
        var area = rect.width.baseVal.value * rect.height.baseVal.value
        if (area > acc.area) {return {area: area, shape: rect}}
        else {return acc}
    }, {area: 0}).shape
}

var navigationList = (svg) => {
    var ul = document.createElement("ul"); ul.id = "nav"
    Array.from(svg.getElementsByTagName("g")).forEach(g => {
        var li = document.createElement("li")
        li.innerText = g.id; ul.append(li)
    })
    return ul
}

var clear = (svg) => {
    Array.from(svg.getElementsByClassName("created")).forEach(x => x.remove())
    Array.from(svg.getElementsByClassName("highlighted")).forEach(x => x.classList = "")
}

var containingId = elem => (elem.id == "" || elem.id == null) ? containingId(elem.parentNode) : elem.id

var clickHandler = (e) => {
    if (e.button != 0) return
    var svg = objectTag.contentDocument.documentElement
    e.preventDefault(); clear(svg)
    if (e.target.innerText == "clear") return
    var target = e.target.innerText ? svg.getElementById(e.target.innerText) : e.target
    if (target) highlightCountry(svg, containingId(target))
}

var highlightCountry = function (svg, countryName) {

    var maxHeight = svg.viewBox.baseVal.height
    var maxWidth  = svg.viewBox.baseVal.width

    // Highlight and outline country
    var countryElement = svg.getElementById(countryName)
    var outlineElement = outline(countryElement)
    svg.append(outlineElement)
    highlightElement(countryElement)
    var country = outlineElement.getBBox()

    // Determine 'largest' quadrant that doesn't overlap
    var largestQuadrantElement = getLargestQuadrant(country, maxWidth, maxHeight)
    if (!largestQuadrantElement) {return}
    svg.appendChild(largestQuadrantElement)
    set(largestQuadrantElement, "id", "largestQuadrant")

    // Determine clone size
    var largestQuadrant = largestQuadrantElement.getBBox()
    var padding = Math.max(maxWidth / 16, maxHeight / 16)
    var clone = { width:  Math.min(largestQuadrant.width  - 2 * padding, maxWidth  / 2),
                height: Math.min(largestQuadrant.height - 2 * padding, maxHeight / 2)}
    var aspectRatio = country.width / country.height
    if (clone.height * aspectRatio < clone.width) {
        // At the maximum clone height, scaling by the aspect ratio produces
        // less than the maximum clone width, so we will reduce the clone
        // width to correspond to the maximum height.
        clone.width = clone.height * aspectRatio
    } else if (clone.width / aspectRatio < clone.height) {
        // Conversely, here the limiting factor is the clone width, so we
        // reduce the clone height to fit.
        clone.height = clone.width / aspectRatio
    }

    var scale = clone.width / country.width
    if (scale < 2) {return}

    // The next two functions help determine the clone position by returning a
    // number which can be interpreted as a line of latitude or longitude to
    // align the clone with. This avoids duplication later because we can
    // repeatedly call these functions with x- and y-values depending on the
    // position of the largest quadrant with respect to the target country.

    // The clone's fixed edge is the one closest to the highlighted country. It
    // could be the top, left, bottom or righ edge. The clone's fixed edge will
    // always be placed <padding> units away from the country, rather than
    // centred in the available space.
    var fixedEdge = function (quadrantDisplacement, countryDisplacement,
        countrySize, cloneSize, padding) {
        if (quadrantDisplacement > countryDisplacement) {
            return countryDisplacement + countrySize + padding
        } else {
            return countryDisplacement - cloneSize - padding
        }
    }

    // The clone's floating edge is orthogonal to the fixed edge. It is the top
    // or left edge, never the bottom or right edge. Ideally it is set so that
    // the midpoint, in this dimension, of the clone and the country coincide.
    // However, it will be clipped to ensure that the clone does not overflow
    // the boundaries of the quadrant it falls in (after adding padding).
    var floatingEdge = function (quadrantDisplacement, maxDisplacement,
        countryDisplacement, countrySize, cloneSize, padding) {
        var ideal = countryDisplacement + (countrySize - cloneSize) / 2
        var lowerBound = quadrantDisplacement + padding
        var upperBound = maxDisplacement - cloneSize - lowerBound
        return Math.max(Math.min(ideal, upperBound), lowerBound)
    }

    // The dividing line between the country and the largest quadrant is
    // parallel to the fixed edge, meaning that the value that determines the
    // position of the fixed edge is in the other dimension.
    var dividingLineAxis = largestQuadrant.height < maxHeight ? "x" : "y"

    // Draw enlargement lines
    outlineElement.classList += " thick" // XXXXX
    var corner = (rect, cornerName) => ({
        "top left":     [rect.x,              rect.y],
        "top right":    [rect.x + rect.width, rect.y],
        "bottom left":  [rect.x,              rect.y + rect.height],
        "bottom right": [rect.x + rect.width, rect.y + rect.height]
    })[cornerName].join(",")
    var flip = s => ({top: "bottom", bottom: "top", left: "right", right: "left", x: "y", y: "x"})[s]
    var flipMaybe = (s, doIt) => !doIt ? s : flip(s)
    if (dividingLineAxis == "x") {
        clone.y = fixedEdge(largestQuadrant.y, country.y, country.height, clone.height, padding)
        clone.x = floatingEdge(largestQuadrant.x, maxWidth, country.x, country.width, clone.width, padding)
        var flip_ = s => flipMaybe(s, clone.y < country.y)
        var guidelines = elem("polygon", {points: [
            corner(country, flip_("bottom") + " left"),
            corner(clone,   flip_("top")    + " left"),
            corner(clone,   flip_("top")    + " right"),
            corner(country, flip_("bottom") + " right")
        ].join(" "), class: "created thick"})
    } else if (dividingLineAxis == "y") {
        clone.x = fixedEdge(largestQuadrant.x, country.x, country.width, clone.width, padding)
        clone.y = floatingEdge(largestQuadrant.y, maxHeight, country.y, country.height, clone.height, padding)
        var flip_ = s => flipMaybe(s, clone.x < country.x)
        var guidelines = elem("polygon", {points: [
            corner(clone,   "bottom " + flip_("left")),
            corner(clone,   "top "    + flip_("left")),
            corner(country, "top "    + flip_("right")),
            corner(country, "bottom " + flip_("right"))
        ].join(" "), class: "created thick"})
    }
    svg.appendChild(guidelines)
    
    // Draw clone
    cloneElement = countryElement.cloneNode(true)
    cloneElement.id += "_enlarged"
    cloneElement.classList = "created enlarged"
    set(cloneElement, "transform",
        "scale(" + scale + ") translate(" +
        (clone.x / scale - country.x) + " " + (clone.y / scale - country.y) + ")"
    )

    var cloneOutline = rect(clone.x, clone.y, clone.width, clone.height)
    svg.appendChild(cloneOutline)
    svg.appendChild(cloneElement)
    cloneOutline.classList += " enlarged thick"

    // Configure download button
    download.setAttribute("download", countryElement.id + ".svg")
    download.setAttribute("href", "data:image/svg+xml;utf8," +  encodeURIComponent(svg.outerHTML))
}

var objectTag = document.getElementById("antilles")
objectTag.addEventListener("load", () => {

    var svg = objectTag.contentDocument.documentElement

    // Generate navigation list at the top of the page
    document.body.prepend(navigationList(svg))
    document.getElementById("nav").addEventListener("click", clickHandler, false)

    // SVG elements can be clicked as well
    objectTag.contentWindow.addEventListener("click", clickHandler, false)

    // Set up download link for saving current SVG canvas
    var download = document.createElement("a"); download.id = "download"
    download.setAttribute("href-lang", "image/svg+xml")
    download.innerText = "Download"
    document.body.prepend(download)

})