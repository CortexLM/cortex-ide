use objc2::{
    define_class, msg_send,
    rc::{Allocated, Retained},
    DeclaredClass,
};
use objc2_app_kit::{
    NSAutoresizingMaskOptions, NSVisualEffectBlendingMode, NSVisualEffectMaterial,
    NSVisualEffectState, NSVisualEffectView,
};
use objc2_core_foundation::CGFloat;
use objc2_foundation::{NSInteger, NSRect};

/// NSVisualEffectViewTagged state.
/// Forced to be public by declare_class! macro.
#[derive(Default, Debug, PartialEq, Eq)]
pub struct NSVisualEffectViewTaggedIvars {
    /// NSView tag to identify the view
    pub tag: NSInteger,
}

define_class!(
    /// A custom NSVisualEffectView subclass
    /// that overrides the tag method to provide a custom tag, to later identify the view
    #[unsafe(super(NSVisualEffectView))]
    #[name = "NSVisualEffectViewTagged"]
    #[ivars = NSVisualEffectViewTaggedIvars]
    pub struct NSVisualEffectViewTagged;

    impl NSVisualEffectViewTagged {
        #[unsafe(method(tag))]
        fn tag(&self) -> NSInteger {
            self.ivars().tag
        }
    }
);

#[allow(non_snake_case)]
impl NSVisualEffectViewTagged {
    /// # Safety
    ///
    /// This method is unsafe because it calls an Objective-C method.
    pub unsafe fn initWithFrame(
        this: Allocated<Self>,
        frame_rect: NSRect,
        tag: NSInteger,
    ) -> Retained<Self> {
        let state = NSVisualEffectViewTaggedIvars { tag };
        let this = this.set_ivars(state);

        msg_send![super(this), initWithFrame: frame_rect]
    }

    /// <https://developer.apple.com/documentation/appkit/nsvisualeffectview/material-swift.property>
    ///
    /// # Safety
    ///
    /// This method is unsafe because it calls an Objective-C method.
    pub unsafe fn setMaterial(&self, material: NSVisualEffectMaterial) {
        let () = msg_send![self, setMaterial: material];
    }

    /// <https://developer.apple.com/documentation/appkit/nsvisualeffectview/blendingmode-swift.property>
    ///
    /// # Safety
    ///
    /// This method is unsafe because it calls an Objective-C method.
    pub unsafe fn setBlendingMode(&self, blending_mode: NSVisualEffectBlendingMode) {
        let () = msg_send![self, setBlendingMode: blending_mode];
    }

    /// <https://developer.apple.com/documentation/appkit/nsvisualeffectview/state-swift.property>
    ///
    /// # Safety
    ///
    /// This method is unsafe because it calls an Objective-C method.
    pub unsafe fn setState(&self, state: NSVisualEffectState) {
        let () = msg_send![self, setState: state];
    }

    /// NSView inherited method
    /// <https://developer.apple.com/documentation/appkit/nsview/autoresizingmask-swift.property>
    ///
    /// # Safety
    ///
    /// This method is unsafe because it calls an Objective-C method.
    pub unsafe fn setAutoresizingMask(&self, mask: NSAutoresizingMaskOptions) {
        let () = msg_send![self, setAutoresizingMask: mask];
    }

    /// Note: This method is not listed in Apple documentation and may be a private API.
    /// It has been tested and works, but use with caution as it may change.
    ///
    /// # Safety
    ///
    /// This method is unsafe because it calls an Objective-C method.
    pub unsafe fn setCornerRadius(&self, radius: CGFloat) {
        let () = msg_send![self, setCornerRadius: radius];

        // Note: An alternative approach would be to use the public layer API:
        // self.setWantsLayer(true);
        // if let Some(layer) = self.layer() {
        //     layer.setCornerRadius(radius);
        // }
    }
}
