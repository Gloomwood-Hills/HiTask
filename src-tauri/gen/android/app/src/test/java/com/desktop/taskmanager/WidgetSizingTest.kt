package com.desktop.taskmanager

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetSizingTest {
  @Test fun smallestWidgetKeepsCompleteRows() {
    assertEquals(2, TaskWidgetProvider.slotsForHeight(110))
    assertEquals(5, TaskWidgetProvider.slotsForHeight(180))
  }

  @Test fun growingWidgetNeverLosesVisibleTasks() {
    for (height in 110..600) {
      val rows = TaskWidgetProvider.slotsForHeight(height)
      assertTrue(rows >= TaskWidgetProvider.slotsForHeight(height - 1))
      val occupied = if (height < 280) 56 + rows * 24 else 118 + rows * 32
      assertTrue("height=$height occupied=$occupied", occupied <= height)
    }
  }
}
