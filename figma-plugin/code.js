// Figma Plugin: Screenshot to Code Import
// Handles custom DOM walker output with computed styles

figma.showUI(__html__);

figma.ui.onmessage = function (msg) {
    if (msg.type === 'cancel') {
        figma.closePlugin();
        return;
    }

    if (msg.type === 'import-design') {
        console.log("=== IMPORT START ===");
        console.log("Layers:", msg.layers ? msg.layers.length : 0);

        renderDesign(msg.layers)
            .then(function () {
                console.log("=== IMPORT COMPLETE ===");
            })
            .catch(function (e) {
                console.error("Import failed:", e);
                figma.notify("Import failed: " + String(e));
            });
    }
};

function renderDesign(layers) {
    return new Promise(function (resolve, reject) {
        try {
            if (!layers || !Array.isArray(layers) || layers.length === 0) {
                figma.notify("No layers received");
                reject(new Error("No layers"));
                return;
            }

            console.log("Processing", layers.length, "layers");

            // First layer is root frame
            var root = layers[0];

            var frame = figma.createFrame();
            frame.name = "Imported Design";

            var width = Math.min(Math.max(root.width || 1440, 100), 5000);
            var height = Math.min(Math.max(root.height || 900, 100), 10000);
            frame.resize(width, height);

            frame.x = figma.viewport.center.x - width / 2;
            frame.y = figma.viewport.center.y - height / 2;

            // Root background
            var rootBg = parseColor(root.backgroundColor);
            if (rootBg) {
                frame.fills = [{ type: 'SOLID', color: rootBg }];
            } else {
                frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
            }

            console.log("Root frame:", width, "x", height);

            // Render all other layers
            var renderPromise = Promise.resolve();
            var count = 0;

            for (var i = 1; i < layers.length; i++) {
                (function (layer) {
                    renderPromise = renderPromise.then(function () {
                        count++;
                        return renderLayer(layer, frame);
                    });
                })(layers[i]);
            }

            renderPromise.then(function () {
                figma.currentPage.appendChild(frame);
                figma.currentPage.selection = [frame];
                figma.viewport.scrollAndZoomIntoView([frame]);
                figma.notify("Imported " + count + " elements!");
                figma.closePlugin();
                resolve();
            }).catch(function (err) {
                console.error("Render error:", err);
                reject(err);
            });

        } catch (err) {
            console.error("renderDesign error:", err);
            reject(err);
        }
    });
}

function parseColor(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return null;

    var str = colorStr.trim().toLowerCase();

    // Skip transparent
    if (str === 'transparent' || str === 'rgba(0, 0, 0, 0)') {
        return null;
    }

    // RGBA
    var rgbaMatch = str.match(/rgba?\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/);
    if (rgbaMatch) {
        return {
            r: parseFloat(rgbaMatch[1]) / 255,
            g: parseFloat(rgbaMatch[2]) / 255,
            b: parseFloat(rgbaMatch[3]) / 255
        };
    }

    // Hex
    if (str.charAt(0) === '#') {
        var hex = str.slice(1);
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        if (hex.length >= 6) {
            return {
                r: parseInt(hex.slice(0, 2), 16) / 255,
                g: parseInt(hex.slice(2, 4), 16) / 255,
                b: parseInt(hex.slice(4, 6), 16) / 255
            };
        }
    }

    // Named colors
    var named = {
        'white': { r: 1, g: 1, b: 1 },
        'black': { r: 0, g: 0, b: 0 },
        'red': { r: 1, g: 0, b: 0 },
        'green': { r: 0, g: 0.5, b: 0 },
        'blue': { r: 0, g: 0, b: 1 },
        'gray': { r: 0.5, g: 0.5, b: 0.5 },
        'grey': { r: 0.5, g: 0.5, b: 0.5 }
    };
    if (named[str]) return named[str];

    return null;
}

function renderLayer(layer, parent) {
    return new Promise(function (resolve) {
        if (!layer) {
            resolve();
            return;
        }

        var type = (layer.type || '').toUpperCase();
        var x = layer.x || 0;
        var y = layer.y || 0;
        var width = Math.max(layer.width || 1, 1);
        var height = Math.max(layer.height || 1, 1);

        try {
            if (type === 'TEXT' && layer.characters) {
                renderText(layer, parent, x, y, resolve);
            } else if (type === 'RECTANGLE' || type === 'IMAGE') {
                renderRect(layer, parent, x, y, width, height, resolve);
            } else {
                // Unknown type, skip
                resolve();
            }
        } catch (err) {
            console.error("Layer error:", err);
            resolve();
        }
    });
}

function renderText(layer, parent, x, y, resolve) {
    var text = figma.createText();
    text.name = layer.name || "Text";

    var fontFamily = layer.fontFamily || "Inter";
    var fontWeight = layer.fontWeight || 400;

    // Clean font family
    if (fontFamily.indexOf(',') !== -1) {
        fontFamily = fontFamily.split(',')[0].trim();
    }
    fontFamily = fontFamily.replace(/["']/g, '');

    // Map weight to style
    var fontStyle = "Regular";
    if (fontWeight >= 700) fontStyle = "Bold";
    else if (fontWeight >= 600) fontStyle = "Semi Bold";
    else if (fontWeight >= 500) fontStyle = "Medium";
    else if (fontWeight <= 300) fontStyle = "Light";

    // Try to load the font
    figma.loadFontAsync({ family: fontFamily, style: fontStyle })
        .catch(function () {
            return figma.loadFontAsync({ family: fontFamily, style: "Regular" });
        })
        .catch(function () {
            fontFamily = "Inter";
            return figma.loadFontAsync({ family: "Inter", style: "Regular" });
        })
        .then(function () {
            try {
                text.fontName = { family: fontFamily, style: fontStyle };
            } catch (e) {
                text.fontName = { family: "Inter", style: "Regular" };
            }

            if (layer.characters) {
                text.characters = layer.characters;
            }

            if (layer.fontSize && layer.fontSize > 0) {
                text.fontSize = layer.fontSize;
            }

            // Text color
            var color = parseColor(layer.color);
            if (color) {
                text.fills = [{ type: 'SOLID', color: color }];
            }

            text.x = x;
            text.y = y;

            if (typeof layer.opacity === 'number' && layer.opacity < 1) {
                text.opacity = layer.opacity;
            }

            parent.appendChild(text);
            resolve();
        })
        .catch(function (e) {
            console.error("Font error:", e);
            resolve();
        });
}

function renderRect(layer, parent, x, y, width, height, resolve) {
    var rect = figma.createRectangle();
    rect.name = layer.name || "Rectangle";
    rect.resize(width, height);
    rect.x = x;
    rect.y = y;

    // Background color
    var bgColor = parseColor(layer.backgroundColor);
    if (bgColor) {
        rect.fills = [{ type: 'SOLID', color: bgColor }];
    } else {
        rect.fills = [];
    }

    // Border radius
    if (layer.borderRadius && layer.borderRadius > 0) {
        rect.cornerRadius = layer.borderRadius;
    }

    // Border/stroke
    if (layer.borderWidth && layer.borderWidth > 0) {
        var borderColor = parseColor(layer.borderColor);
        if (borderColor) {
            rect.strokes = [{ type: 'SOLID', color: borderColor }];
            rect.strokeWeight = layer.borderWidth;
        }
    }

    // Opacity
    if (typeof layer.opacity === 'number' && layer.opacity < 1) {
        rect.opacity = layer.opacity;
    }

    parent.appendChild(rect);
    resolve();
}
