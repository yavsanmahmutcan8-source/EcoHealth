# Import all the models, so that Base has them before being
# imported by Alembic
from db.base_class import Base
from models.user import User
from models.activity import Activity
from models.category import Category
from models.review import Review
from models.badge_definition import BadgeDefinition
from models.completion_log import CompletionLog
from models.notification import Notification
