package com.controndepatron

import android.os.SystemClock
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

class GpsClockModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "GpsClock"
    // Includes device sleep and is unaffected by manual wall-clock changes.
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun now(): Double = SystemClock.elapsedRealtime().toDouble()
}
class GpsClockPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(GpsClockModule(context))
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
