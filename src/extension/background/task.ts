class Task {
  private active = true;

  get isActive() {
    return this.active;
  }

  cancel() {
    this.active = false;
  }

  end() {
    if (!this.active) {
      throw new Error("Canceled");
    }
    this.active = false;
  }
}

export class TaskSingleton {
  private task: Task | null = null;

  isActive() {
    return this.task?.isActive ?? false;
  }

  begin() {
    if (this.task) {
      this.task.cancel();
    }

    this.task = new Task();

    return this.task;
  }

  cancel() {
    if (this.task) {
      this.task.cancel();
      this.task = null;
    }
  }
}

