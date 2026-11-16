import AppKit
let size = 1024
let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()
let background = NSBezierPath(roundedRect: NSRect(x: 60, y: 60, width: 904, height: 904), xRadius: 204, yRadius: 204)
NSColor(calibratedRed: 0.075, green: 0.095, blue: 0.115, alpha: 1).setFill()
background.fill()
NSColor(calibratedRed: 0.30, green: 0.35, blue: 0.40, alpha: 0.4).setStroke()
background.lineWidth = 2
background.stroke()
NSColor(calibratedRed: 0.84, green: 0.65, blue: 0.45, alpha: 1).setStroke()
let ring = NSBezierPath(ovalIn: NSRect(x: 282, y: 282, width: 460, height: 460))
ring.lineWidth = 28
ring.stroke()
NSGraphicsContext.saveGraphicsState()
let transform = NSAffineTransform()
transform.translateX(by: 512, yBy: 512)
transform.rotate(byDegrees: 28)
transform.concat()
let orbit = NSBezierPath(ovalIn: NSRect(x: -342, y: -86, width: 684, height: 172))
orbit.lineWidth = 22
orbit.stroke()
NSGraphicsContext.restoreGraphicsState()
NSColor(calibratedRed: 0.94, green: 0.82, blue: 0.65, alpha: 1).setFill()
NSBezierPath(ovalIn: NSRect(x: 762, y: 608, width: 47, height: 47)).fill()
image.unlockFocus()
let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
