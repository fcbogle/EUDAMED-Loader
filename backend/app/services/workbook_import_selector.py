"""Choose the importer on the server; callers cannot override the environment."""
from app.config import get_settings
from app.services.production_workbook_import import ProductionWorkbookImporter
from app.services.workbook_import import WorkbookImportService


def workbook_importer():
    return ProductionWorkbookImporter() if get_settings().environment == "prod" else WorkbookImportService()
