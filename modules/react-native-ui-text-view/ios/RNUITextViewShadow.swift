class RNUITextViewShadow: RCTShadowView {
  // Props
  @objc var numberOfLines: Int = 0 {
    didSet {
      if !YGNodeIsDirty(self.yogaNode) {
        self.setAttributedText()
      }
    }
  }
  @objc var allowsFontScaling: Bool = true

  var attributedText: NSAttributedString = NSAttributedString()
  var frameSize: CGSize = CGSize()

  var lineHeight: CGFloat = 0

  var bridge: RCTBridge

  init(bridge: RCTBridge) {
    self.bridge = bridge
    super.init()

    // We need to set a custom measure func here to calculate the height correctly
    YGNodeSetMeasureFunc(self.yogaNode) { node, width, widthMode, height, heightMode in
      // Get the shadowview and determine the needed size to set
      let shadowView = Unmanaged<RNUITextViewShadow>.fromOpaque(YGNodeGetContext(node)).takeUnretainedValue()
      return shadowView.getNeededSize(maxWidth: width)
    }

    // Subscribe to ynamic type size changes
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(preferredContentSizeChanged(_:)),
      name: UIContentSizeCategory.didChangeNotification,
      object: nil
    )
  }

  @objc func preferredContentSizeChanged(_ notification: Notification) {
    self.setAttributedText()
  }

  // Tell yoga not to use flexbox
  override func isYogaLeafNode() -> Bool {
    return true
  }

  // We only need to insert text children
  override func insertReactSubview(_ subview: RCTShadowView!, at atIndex: Int) {
    if subview.isKind(of: RNUITextViewChildShadow.self) {
      super.insertReactSubview(subview, at: atIndex)
    }
  }

  // Whenever the subvies update, set the text
  override func didUpdateReactSubviews() {
    self.setAttributedText()
  }

  // Whenever we layout, update the UI
  override func layoutSubviews(with layoutContext: RCTLayoutContext) {
    // Don't do anything if the layout is dirty
    if(YGNodeIsDirty(self.yogaNode)) {
      return
    }

    // Update the text
    self.bridge.uiManager.addUIBlock { uiManager, viewRegistry in
      guard let textView = viewRegistry?[self.reactTag] as? RNUITextView else {
        return
      }
      textView.setText(string: self.attributedText, size: self.frameSize, numberOfLines: self.numberOfLines)
    }
  }

  override func dirtyLayout() {
    super.dirtyLayout()
    YGNodeMarkDirty(self.yogaNode)
  }

  // Update the attributed text whenever changes are made to the subviews.
  func setAttributedText() -> Void {
    // Create an attributed string to store each of the segments
    let finalAttributedString = NSMutableAttributedString()

    self.reactSubviews().forEach { child in
      guard let child = child as? RNUITextViewChildShadow else {
        return
      }
      let scaledFontSize = self.allowsFontScaling ?
        UIFontMetrics.default.scaledValue(for: child.fontSize) : child.fontSize

      // Set some generic attributes that don't need ranges
      let attributes: [NSAttributedString.Key:Any] = [
        .font: UIFont.systemFont(
          ofSize: scaledFontSize,
          weight: child.getFontWeight()
        ),
        .foregroundColor: child.color,
      ]

      // Create the attributed string with the generic attributes
      let string = NSMutableAttributedString(string: child.text, attributes: attributes)

      // Set the paragraph style attributes if necessary
      let paragraphStyle = NSMutableParagraphStyle()
      paragraphStyle.minimumLineHeight = child.lineHeight
      paragraphStyle.maximumLineHeight = child.lineHeight
      string.addAttribute(
        NSAttributedString.Key.paragraphStyle,
        value: paragraphStyle,
        range: NSMakeRange(0, string.length)
      )

      self.lineHeight = child.lineHeight

      finalAttributedString.append(string)
    }

    self.attributedText = finalAttributedString
    self.dirtyLayout()
  }

  // Create a YGSize based on the max width
  func getNeededSize(maxWidth: Float) -> YGSize {
    let maxSize = CGSize(width: CGFloat(maxWidth), height: CGFloat(MAXFLOAT))
    let textSize = self.attributedText.boundingRect(with: maxSize, options: .usesLineFragmentOrigin, context: nil)
    self.frameSize = textSize.size
    return YGSize(width: Float(textSize.width), height: Float(textSize.height))
  }
}
