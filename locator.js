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

    var max = {height: svg.viewBox.baseVal.height, width: svg.viewBox.baseVal.width}

    // Highlight and outline country
    var countryElement = svg.getElementById(countryName)
    var outlineElement = outline(countryElement)
    svg.append(outlineElement)
    highlightElement(countryElement)
    var country = outlineElement.getBBox()

    // Determine 'largest' quadrant that doesn't overlap
    var largestQuadrantElement = getLargestQuadrant(country, max.width, max.height)
    if (!largestQuadrantElement) {return}
    svg.appendChild(largestQuadrantElement)
    set(largestQuadrantElement, "id", "largestQuadrant")

    // Determine clone size
    var largestQuadrant = largestQuadrantElement.getBBox()
    var padding = Math.max(max.width / 16, max.height / 16)
    var clone = { width:  Math.min(largestQuadrant.width - 2 * padding, max.width  / 2),
                 height: Math.min(largestQuadrant.height - 2 * padding, max.height / 2)}
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

    // Configure download button
    download.setAttribute("download", countryElement.id + ".svg")
    download.setAttribute("href", "data:image/svg+xml;utf8," +  encodeURIComponent(svg.outerHTML))

    // Don't proceed any further if the locator map isn't at least twice the size.
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
    var dividingLineAxis = largestQuadrant.height < max.height ? "x" : "y"

    // Given a <rect> and the name of a corner, eg. top left, return the
    // coordinates of that corner.
    var corner = (rect, yDirection, xDirection) => (
        {left: rect.x, right:  rect.x + rect.width }[xDirection] + "," +
        {top:  rect.y, bottom: rect.y + rect.height}[yDirection] )

    var flip = s => ({
        top: "bottom", bottom: "top", left: "right",   right: "left",
        x: "y",             y: "x",  width: "height", height: "width"
    })[s]
    var flipIf = doIt => doIt ? flip : (x => x)
    var flipAxis = flipIf(dividingLineAxis == "y")

    clone[flipAxis("x")] = floatingEdge(
        largestQuadrant[flipAxis("x")],
        max[flipAxis("width")],
        country[flipAxis("x")],
        country[flipAxis("width")],
        clone[flipAxis("width")],
        padding)

    clone[flipAxis("y")] = fixedEdge(
        largestQuadrant[flipAxis("y")],
        country[flipAxis("y")],
        country[flipAxis("height")],
        clone[flipAxis("height")],
        padding)

    // Draw guidelines connecting country outline to clone outline
    outlineElement.classList += " thick"
    var flipVertical   = flipIf(clone.y < country.y && dividingLineAxis == "x")
    var flipHorizontal = flipIf(clone.x < country.x && dividingLineAxis == "y")
    var countryOrClone = {x: country, y: clone}
    var guidelines = elem("polygon", {points: [
        corner(countryOrClone[flipAxis("x")], flipVertical("bottom"), flipHorizontal("left")),
        corner(countryOrClone[flipAxis("y")], flipAxis(flipVertical("top")), flipAxis(flipHorizontal("left"))),
        corner(countryOrClone[flipAxis("y")], flipVertical("top"), flipHorizontal("right")),
        corner(countryOrClone[flipAxis("x")], flipAxis(flipVertical("bottom")), flipAxis(flipHorizontal("right")))
    ].join(" "), class: "created thick"})
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
}

var objectTag = document.getElementById("antilles")
objectTag.addEventListener("load", () => {
    var svg = objectTag.contentDocument.documentElement

    // Add custom styles
    svg.prepend(document.getElementById("svgStyles"))

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